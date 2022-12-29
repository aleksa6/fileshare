const fs = require("fs");

const mongoose = require("mongoose");

const Group = require("./group");

const Schema = mongoose.Schema;

const userSchema = new Schema({
	name: { type: String, required: true },
	username: String,
	email: { type: String, required: true },
	password: { type: String, required: true },
	resetToken: String,
	resetTokenExpiration: Date,
	groups: [
		{
			_id: {
				type: Schema.Types.ObjectId,
				ref: "Group",
			},
			personalStorage: [{ type: Schema.Types.ObjectId, ref: "File" }],
		},
	],
});

userSchema.methods.deleteAccount = async function (req, res) {
	const user = this;
	const userId = user._id;
	const groups = await Group.find({ participants: userId });

	// const deletedGroups = [];

	for (const group of groups) {
		group.participants.pull(userId);
		group.admins.pull(userId);

		if (group.participants.length < 1) {
			await group.delete();
			// deletedGroups.push(group.name);
			continue;
		}

		if (group.admins.length < 1) group.admins.push(group.participants[0]);

		if (userId.toString() === group.owner.toString())
			group.owner = group.admins[0];

		await group.save();
	}

	await user.delete();

	req.session.destroy(() => {
		res.redirect("/");
	});

	// return deletedGroups;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
