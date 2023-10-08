const crypto = require("crypto");

const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const {
	message,
	isAdmin,
	isMember,
	isValid,
	error,
	clearFiles,
} = require("../util/util");
const Group = require("../models/group");

const User = require("../models/user");
const File = require("../models/file");
const Message = require("../models/message");

exports.homePage = async (req, res, next) => {
	try {
		res.render("main/home", {
			pageTitle: "Home",
		});
	} catch (err) {
		next(err);
	}
};

exports.getJoin = async (req, res, next) => {
	try {
		const error = req.flash("error")[0];
		const message = req.flash("message")[0];

		res.render("main/join", {
			pageTitle: "Join Group",
			error: error?.message,
			message: message || null,
			oldInput: error?.oldInput,
			fields: error?.fields,
		});
	} catch (err) {
		next(err);
	}
};

exports.postJoin = async (req, res, next) => {
	try {
		const { code, password } = req.body;

		const group = await Group.findOne({ code });

		if (!group) {
			req.flash("error", {
				message: "Could not find a group with this ID",
				oldInput: { code, password },
				fields: ["code"],
			});

			return req.session.save((err) => {
				res.redirect("/join");
			});
		}

		const isEqual = await bcrypt.compare(password, group.password);
		if (!isEqual) {
			req.flash("error", {
				message: "Wrong password",
				oldInput: { code, password },
				fields: ["password"],
			});

			return req.session.save((err) => {
				res.redirect("/join");
			});
		}

		if (req.session?.isLoggedIn) {
			const userId = req.session?.user._id;

			const user = await User.findById(userId);

			if (!user)
				error(
					"Invalid Param",
					"Could not find a user with the ID from the request"
				);

			if (
				user.groups.findIndex(
					(obj) => obj._id.toString() === group._id.toString()
				) === -1
			) {
				user.groups.push({ _id: group._id, personalStorage: [] });
				await user.save();
				group.participants.push(user._id);
				await group.save();
			}
		} else {
			req.session.isInGroup = true;
			req.session.group = group;
		}

		req.session.save((err) => {
			res.redirect(`/groups/${group._id.toString()}`);
		});
	} catch (err) {
		next(err);
	}
};

exports.getCreateGroup = async (req, res, next) => {
	try {
		const error = req.flash("error")[0];

		res.render("main/create-group", {
			pageTitle: "Create Group",
			error: error?.message,
			oldInput: error?.oldInput,
			fields: error?.fields,
		});
	} catch (err) {
		next(err);
	}
};

exports.postCreateGroup = async (req, res, next) => {
	try {
		const { name, description, password, passwordConf } = req.body;

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			req.flash("error", {
				message: errors.array()[0].msg,
				oldInput: {
					name,
					description,
					password,
					passwordConf,
				},
				fields: errors.array().map((err) => err.param),
			});
			return req.session.save((err) => {
				res.redirect("/create-group");
			});
		}

		const userId = req.session?.user._id;

		const user = await User.findById(userId);

		if (!user)
			error(
				"Invalid Param",
				"Could not find a user with the ID from the request"
			);

		const hashedPw = await bcrypt.hash(password, 12);

		const code = crypto.randomBytes(4);

		const group = await Group.create({
			name,
			description,
			password: hashedPw,
			owner: user._id,
			admins: [user._id],
			messages: [],
			participants: [user._id],
			code: code.toString("hex"),
		});

		user.groups.push({ _id: group._id, personalStorage: [] });
		await user.save();

		message(req, res, "Group Created", "Group successfully created", true);
	} catch (err) {
		next(err);
	}
};

exports.deleteGroup = async (req, res, next) => {
	try {
		const groupId = req.body.groupId;
		const userId = req.session?.user._id;

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");

		const group = await Group.findById(groupId);
		const user = await User.findById(userId);

		if (!group)
			error(
				"Group Not Found",
				"Could not find a group with the ID from the request"
			);

		if (userId.toString() !== group.owner.toString())
			error("Invalid Action", "Only owner of the group can delete it");

		await group.delete();
		await User.updateMany(
			{ _id: { $in: this.participants } },
			{ $pull: { groups: this._id } }
		);

		res.redirect("/groups");
	} catch (err) {
		next(err);
	}
};

exports.leaveGroup = async (req, res, next) => {
	try {
		const userId = req.session?.user._id;
		const groupId = req.body.groupId;

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");

		const user = await User.findById(userId);
		const group = await Group.findById(groupId);

		if (!user)
			error(
				"User Not Found",
				"Could not find a user with the ID from the request"
			);

		if (!group)
			error(
				"Group Not Found",
				"Could not find a group with the ID from the request"
			);

		const isDeleted = await group.removeUser(userId);

		user.groups.pull({ _id: group._id });
		await user.save();

		if (isDeleted)
			req.flash(
				"alertMessage",
				`Group have been deleted because there were no members left`
			);

		req.session.save((err) => {
			res.redirect("/groups");
		});
	} catch (err) {
		next(err);
	}
};

exports.getGroups = async (req, res, next) => {
	try {
		const userId = req.session?.user._id;

		const user = await User.findById(userId)
			.lean()
			.populate("groups._id", "name description code");

		if (!user)
			error(
				"Invalid Param",
				"Could not find a user with the ID from the request"
			);

		res.render("main/groups", {
			pageTitle: "My Groups",
			groups: user.groups.map((group) => group._id),
		});
	} catch (err) {
		next(err);
	}
};

exports.getGroup = async (req, res, next) => {
	try {
		const groupId = req.params.groupId;

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");

		const group = await Group.findById(groupId)
			.populate({
				path: "messages",
				select: "description files createdAt",
				populate: [
					{ path: "sender", select: "name" },
					{ path: "files", select: "filename" },
				],
			})
			.lean();

		if (!group)
			error(
				"Group Not Found",
				"Could not find a group with the ID from the url"
			);

		if (!isMember(req, group))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to access it"
			);

		const oldInput = req.flash("oldInput")[0];

		res.render("main/group", {
			pageTitle: group.name,
			isAdmin: isAdmin(req, group),
			isLoggedIn: req.session?.isLoggedIn,
			group,
			oldInput,
		});
	} catch (err) {
		next(err);
	}
};

exports.sendMessage = async (req, res, next) => {
	try {
		const groupId = req.body.groupId;

		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			req.flash("alertMessage", errors.array()[0].msg);
			clearFiles(req);
			return req.session.save((err) => {
				res.redirect(`/groups/${groupId}`);
			});
		}

		if (req.files.length < 1) {
			req.flash(
				"alertMessage",
				"Our purpose is to help people share files. Therefore, you must provide a file"
			);
			req.flash("oldInput", { description: req.body.description });

			return req.session.save((err) => {
				res.redirect(`/groups/${groupId}`);
			});
		}

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");

		const group = await Group.findById(groupId);

		if (!group)
			error(
				"Group Not Found",
				"Could not find a group with the ID from the request"
			);

		if (!isMember(req, group))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to download and share files"
			);

		if (!isAdmin(req, group))
			error("Not Authorized", "Only admins can send messages");

		const userId = req.session?.user._id;

		const notification = new Message({
			description: req.body.description,
			sender: userId,
			group: group._id,
			files: [],
		});

		for (const fileData of req.files) {
			const file = await File.create({
				filename: fileData.originalname,
				mimetype: fileData.mimetype,
				path: fileData.path,
				message: notification.group,
			});

			notification.files.push(file._id);
		}

		await notification.save();

		group.messages.push(notification._id);

		await group.save();

		req.flash("alertMessage", "Message is successfully sent");
		req.session.save((err) => {
			res.redirect(`/groups/${group._id.toString()}`);
		});
	} catch (err) {
		next(err);
	}
};

exports.download = async (req, res, next) => {
	try {
		const fileId = req.params.fileId;

		if (!isValid(fileId)) error("Invalid Param", "Group ID is invalid");

		const file = await File.findById(req.params.fileId).populate(
			"message",
			"group state"
		);

		if (!isMember(req, { _id: file.group }))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to download and share files"
			);

		res.download(file.path, file.filename);
	} catch (err) {
		next(err);
	}
};

exports.getMembers = async (req, res, next) => {
	try {
		const groupId = req.params.groupId;

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");

		const group = await Group.findById(groupId);

		if (!group)
			error(
				"Group Not Gound",
				"Could not find a group with the ID from the url"
			);

		if (!isMember(req, group))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to access it"
			);

		const isAdministrator = isAdmin(req, group);

		await group.populate("participants", "username");

		group.participants = group.participants.map((user) => ({
			...user,
			isAdministrator: isAdmin(
				{ session: { isLoggedIn: true, user: { _id: user._id } } },
				group
			),
			isOwner: group.owner.toString() === user._id.toString(),
		}));

		res.render("main/members", {
			pageTitle: "Members",
			name: group.name,
			groupId: group._id,
			members: group.participants,
			currentUser: {
				isAdmin: isAdministrator,
				isOwner: group.owner.toString() === req.session?.user._id.toString(),
				_id: req.session?.user._id,
			},
		});
	} catch (err) {
		next(err);
	}
};

exports.removeUser = async (req, res, next) => {
	try {
		const groupId = req.body.groupId;
		const userId = req.body.userId;

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");
		if (!isValid(userId)) error("Invalid Param", "User ID is invalid");

		const group = await Group.findById(groupId);
		const user = await User.findById(userId);

		if (!group)
			error(
				"Group Not Gound",
				"Could not find a group with the ID from the url"
			);

		if (!user)
			error("User Not Gound", "Could not find a user with the ID from the url");

		if (!isAdmin(req, group))
			error(
				"Access Denied",
				"You have to be administrator to be able to manage users"
			);

		if (
			!isMember(
				{
					session: {
						isLoggedIn: true,
						user: { _id: userId },
					},
				},
				group
			)
		)
			error(
				"Access Denied",
				"You can't remove a user who's not a member of the group"
			);

		const isAdministrator = isAdmin(
			{ session: { isLoggedIn: true, user: { _id: userId } } },
			group
		);

		if (group.owner._id.toString() === userId)
			error("Invalid Action", "Owner can't be removed from the group");

		if (
			isAdministrator &&
			group.owner.toString() !== req.session?.user._id.toString()
		)
			error(
				"Invalid Action",
				"Only owner can remove administrators from the group"
			);

		await group.removeUser(userId);

		user.groups.pull({
			_id: groupId,
		});
		await user.save();

		res.redirect(`/groups/${groupId.toString()}/members`);
	} catch (err) {
		next(err);
	}
};

exports.addAdmin = async (req, res, next) => {
	try {
		const userId = req.body.userId;
		const groupId = req.body.groupId;

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");
		if (!isValid(userId)) error("Invalid Param", "User ID is invalid");

		const group = await Group.findById(groupId);

		if (!group)
			error(
				"Group Not Gound",
				"Could not find a group with the ID from the url"
			);

		if (!isMember(req, group))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to manage users"
			);

		if (
			!isMember({ session: { isLoggedIn: true, user: { _id: userId } } }, group)
		)
			error(
				"Invalid Action",
				"User you tried to add to admins is not a member of the group"
			);

		if (req.session?.user._id.toString() !== group.owner.toString())
			error("Unauthorized", "Only owners can manage admins");

		if (
			isAdmin({ session: { isLoggedIn: true, user: { _id: userId } } }, group)
		)
			error(
				"Invalid Action",
				"User you tried to add to admins is already an administrator"
			);

		group.admins.push(new mongoose.Types.ObjectId(userId));

		await group.save();

		res.redirect(`/groups/${groupId.toString()}/members`);
	} catch (err) {
		next(err);
	}
};

exports.removeAdmin = async (req, res, next) => {
	try {
		const userId = req.body.userId;
		const groupId = req.body.groupId;

		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");
		if (!isValid(userId)) error("Invalid Param", "User ID is invalid");

		const group = await Group.findById(groupId);

		if (!group)
			error(
				"Group Not Gound",
				"Could not find a group with the ID from the url"
			);

		if (!isMember(req, group))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to manage users"
			);

		if (
			!isMember({ session: { isLoggedIn: true, user: { _id: userId } } }, group)
		)
			error(
				"Invalid Action",
				"User you tried to remove from admins is not a member of the group"
			);

		if (req.session?.user._id.toString() !== group.owner.toString())
			error("Unauthorized", "Only owners can manage admins");

		if (
			!isAdmin({ session: { isLoggedIn: true, user: { _id: userId } } }, group)
		)
			error(
				"Invalid Action",
				"User you tried to remove from admins is not an administrator"
			);

		group.admins.pull({ _id: new mongoose.Types.ObjectId(userId) });

		await group.save();

		res.redirect(`/groups/${groupId.toString()}/members`);
	} catch (err) {
		next(err);
	}
};

exports.getPersonalStorage = async (req, res, next) => {
	try {
		const groupId = req.params.groupId;
		const username = req.params.username;
		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");

		const group = await Group.findById(groupId);
		const user = await User.findOne({
			username: username.slice(0, -4).concat("#").concat(username.slice(-4)),
		});

		if (!user)
			error(
				"User Not Found",
				"Could not find a user with the ID from the request"
			);
		if (!group)
			error(
				"Group Not Gound",
				"Could not find a group with the ID from the url"
			);

		if (!isMember(req, group))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to see other's storages"
			);

		if (
			!isMember(
				{ session: { isLoggedIn: true, user: { _id: user._id.toString() } } },
				group
			)
		)
			error(
				"Invalid Action",
				"You can't see the user's storage because user either doesn't exists or is not a member of the group"
			);

		const storage = user.groups.find(
			(group) => group._id.toString() === groupId.toString()
		);

		console.log(storage);

		res.render("main/storage", {
			pageTitle: "Personal Storage",
			items: storage.personalStorage,
		});
	} catch (err) {
		next(err);
	}
};

exports.uploadToStorage = async (req, res, next) => {
	try {
		const groupId = req.params.groupId;
		const username = req.params.username;
		if (!isValid(groupId)) error("Invalid Param", "Group ID is invalid");

		const group = await Group.findById(groupId);
		const user = await User.findOne({
			username: username.slice(0, -4).concat("#").concat(username.slice(-4)),
		});

		if (!user)
			error(
				"User Not Found",
				"Could not find a user with the ID from the request"
			);
		if (!group)
			error(
				"Group Not Gound",
				"Could not find a group with the ID from the url"
			);

		if (!isMember(req, group))
			error(
				"Access Denied",
				"You have to be a member of the group to be able to see other's storages"
			);

		if (
			!isMember(
				{ session: { isLoggedIn: true, user: { _id: user._id.toString() } } },
				group
			)
		)
			error(
				"Invalid Action",
				"You can't see the user's storage because user either doesn't exists or is not a member of the group"
			);

		const storage = user.groups.find(
			(group) => group._id.toString() === groupId.toString()
		);
	} catch (err) {
		next(err);
	}
};

exports.message = async (req, res, next) => {
	try {
		let message = req.flash("message")[0];

		if (!message)
			message = {
				pageTitle: "Message",
				message: "This page is used for displaying server messages",
				isSuccess: true,
			};

		res.render("main/message", {
			pageTitle: message?.pageTitle,
			message: message?.message,
			isSuccess: message?.isSuccess,
		});
	} catch (err) {
		next(err);
	}
};
