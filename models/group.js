const fs = require("fs");

const mongoose = require("mongoose");

const { flat } = require("../util/util");
const User = require("./user");

const Schema = mongoose.Schema;

const groupSchema = new Schema({
	name: { type: String, required: true },
	description: { type: String, required: true },
	password: { type: String, required: true },
	code: String,
	owner: { type: Schema.Types.ObjectId, ref: "User" },
	admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
	messages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
	pendingMessages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
	participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

groupSchema.statics.clearUserInfo = async function (userId) {
	userId = new mongoose.Types.ObjectId(userId);

	const user = await User.findById(userId);
	const groups = await Group.find({ participants: userId });

	await user.update({ $pull: { groups: { $in: groups } } });

	const deletedGroups = [];

	for (const group of groups) {
		group.participants.pull(userId);
		group.admins.pull(userId);

		if (group.participants.length < 1) {
			await group.delete();
			deletedGroups.push(group.name);
			continue;
		}

		if (group.admins.length < 1) group.admins.push(group.participants[0]);

		if (userId.toString() === group.owner.toString())
			group.owner = group.admins[0];

		await group.save();
	}

	return deletedGroups;
};

groupSchema.pre("remove", async function (next) {
	try {
		await this.populate("messages");
		console.log(this);
	} catch (err) {
		next(err);
	}
});

groupSchema.pre("deleteMany", async function (next) {
	try {
		const groups = await Group.find(this._conditions)
			.populate([
				{
					path: "messages",
					select: "files",
					populate: [{ path: "files", select: "path" }],
				},
				{
					path: "pendingMessages",
					select: "files",
					populate: [{ path: "files", select: "path" }],
				},
			])
			.lean();

		const paths = flat(
			groups.reduce((files, group) => {
				files.push(
					...group.messages.map((message) =>
						message.files.map((file) => file.path)
					)
				);
				files.push(
					...group.pendingMessages.map((message) =>
						message.files.map((file) => file.path)
					)
				);
				return files;
			}, [])
		);

		for (const path of paths) {
			await fs.unlink(path, (err) => console.log(err));
		}

		next();
	} catch (err) {
		next(err);
	}
});

const Group = mongoose.model("Group", groupSchema);
module.exports = Group;
