const crypto = require("crypto");

const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const mongoose = require("mongoose");

const { message, updateNames } = require("../util/util");
const User = require("../models/user");
const Group = require("../models/group");

const transporter = nodemailer.createTransport(
	sendgridTransport({
		auth: {
			api_key: process.env.SENDGRID_API_KEY,
		},
	})
);

exports.getSignup = async (req, res, next) => {
	try {
		const error = req.flash("error")[0];

		res.render("auth/signup", {
			pageTitle: "Signup",
			error: error?.message,
			oldInput: error?.oldInput,
			fields: error?.fields,
		});
	} catch (err) {
		next(err);
	}
};

exports.postSignup = async (req, res, next) => {
	try {
		const { name, email, password, passwordConf } = req.body;

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			req.flash("error", {
				message: errors.array()[0].msg,
				oldInput: { name, email, password, passwordConf },
				fields: errors.array().map((err) => err.param),
			});
			return req.session.save((err) => {
				res.redirect("/auth/signup");
			});
		}

		const hashedPw = await bcrypt.hash(password, 12);

		const id = updateNames(name);
		const username = `${name}#${id.toString().padStart(4, 0)}`;

		await User.create({
			name,
			email,
			password: hashedPw,
			username,
			groups: [],
		});

		req.flash("message", "Account created successfully. Try to login now");

		return req.session.save((err) => {
			res.redirect("/auth/login");
		});
	} catch (err) {
		next(err);
	}
};

exports.getLogin = async (req, res, next) => {
	try {
		const error = req.flash("error")[0];
		const message = req.flash("message")[0];

		res.render("auth/login", {
			pageTitle: "Login",
			message: message || null,
			error: error?.message,
			oldInput: error?.oldInput,
			fields: error?.fields,
		});
	} catch (err) {
		next(err);
	}
};

exports.postLogin = async (req, res, next) => {
	try {
		const { email, password } = req.body;

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			req.flash("error", {
				message: errors.array()[0].msg,
				oldInput: { email, password },
				fields: errors.array().map((err) => err.param),
			});
			return req.session.save((err) => {
				res.redirect("/auth/login");
			});
		}

		const user = await User.findOne({ email });
		if (!user) {
			req.flash("error", {
				message: "User with this email address does not exist. Try to signup",
				oldInput: { email, password },
				fields: ["email", "password"],
			});
			return req.session.save((err) => {
				res.redirect("/auth/login");
			});
		}

		const isEqual = await bcrypt.compare(password, user.password);

		if (!isEqual) {
			req.flash("error", {
				message: "Wrong password. Try again",
				oldInput: { email, password },
				fields: ["password"],
			});
			return req.session.save((err) => {
				res.redirect("/auth/login");
			});
		}

		req.session.isLoggedIn = true;
		req.session.user = user;
		req.session.isInGroup = false;
		req.session.group = false;

		return req.session.save((err) => {
			res.redirect("/groups");
		});
	} catch (err) {
		next(err);
	}
};

exports.getReset = async (req, res, next) => {
	try {
		const error = req.flash("error")[0];
		const message = req.flash("message")[0];

		res.render("auth/reset", {
			pageTitle: "Reset password",
			message: message || null,
			error: error?.message,
			oldInput: error?.oldInput,
			fields: error?.fields,
		});
	} catch (err) {
		next(err);
	}
};

exports.postReset = async (req, res, next) => {
	try {
		const { email } = req.body;

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			req.flash("error", {
				message: errors.array()[0].msg,
				oldInput: { email },
				fields: errors.array().map((err) => err.param),
			});
			return req.session.save((err) => {
				res.redirect("/auth/reset");
			});
		}

		const buffer = await crypto.randomBytes(32);
		const token = buffer.toString("hex");

		const user = await User.findOne({ email });

		if (user) {
			user.resetToken = token;
			user.resetTokenExpiration = Date.now() + 3600000;
			await user.save();

			transporter.sendMail({
				to: req.body.email,
				from: "kevicaaleksa2@gmail.com",
				subject: "Password reset",
				html: `
          <p>You requested a password reset</p>
          <p>Click this <a href='http://localhost:3000/auth/new-password/${token}'>Change password</a> to set a new password.</p>
        `,
			});
		}

		message(
			req,
			res,
			"Reset Link Sent",
			"We just sent an email that contains your password reset link",
			true
		);
	} catch (err) {
		next(err);
	}
};

exports.getNewPassword = async (req, res, next) => {
	try {
		const token = req.params.token;
		const user = await User.findOne({
			resetToken: token,
			resetTokenExpiration: { $gt: Date.now() },
		});
		if (!user)
			return message(
				req,
				res,
				"Invalid Token",
				"Reset token expired or is invalid",
				false
			);

		const error = req.flash("error")[0];

		res.render("auth/new-password", {
			pageTitle: "Change Password",
			error: error?.message,
			token,
			userId: user._id.toString(),
			oldInput: error?.oldInput,
			fields: error?.fields,
		});
	} catch (err) {
		next(err);
	}
};

exports.postNewPassword = async (req, res, next) => {
	try {
		const { password, passwordConf, userId, token } = req.body;

		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			req.flash("error", {
				message: errors.array()[0].msg,
				oldInput: { password, passwordConf, userId, token },
				fields: errors.array().map((err) => err.param),
			});
			return req.session.save((err) => {
				res.redirect(`/auth/new-password/${token}`);
			});
		}

		const user = await User.findOne({
			resetToken: token,
			resetTokenExpiration: { $gt: Date.now() },
		});

		if (!user)
			return message(
				req,
				res,
				"Invalid Token",
				"Reset token expired or is invalid",
				false
			);

		const newPassword = await bcrypt.hash(password, 12);
		user.password = newPassword;
		user.resetToken = undefined;
		user.resetTokenExpiration = undefined;
		await user.save();

		req.flash("message", "Password successfully changed. Try to login now");
		req.session.save((err) => {
			res.redirect("/auth/login");
		});
	} catch (err) {
		next(err);
	}
};

exports.logout = async (req, res, next) => {
	try {
		req.session.destroy(() => {
			res.redirect("/");
		});
	} catch (err) {
		next(err);
	}
};

exports.deleteAccount = async (req, res, next) => {
	try {
		const userId = req.session?.user._id;

		const user = await User.findById(userId);

		if (!user) error("User Not Found", "Could not find a user");

		await Group.deleteMany({ owner: new mongoose.Types.ObjectId(userId) });
		await Group.updateMany(
			{ _id: { $in: user.groups } },
			{ $pull: { admins: userId, participants: userId } }
		);
		await user.delete();

		req.session.destroy(() => {
			res.redirect("/");
		});
	} catch (err) {
		next(err);
	}
};
