const fs = require("fs");

const mongoose = require("mongoose");

const { getFiles } = require("../util/util");

const Schema = mongoose.Schema;

const groupSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  password: { type: String, required: true },
  code: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: "User" },
  admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
  messages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
  participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

groupSchema.methods.removeUser = async function (userId) {
  this.participants.pull(userId);
  this.admins.pull(userId);

  if (this.participants.length < 1) {
    await this.delete();
    return true;
  }

  if (this.admins.length < 1) this.admins.push(this.participants[0]);

  if (userId.toString() === this.owner.toString()) this.owner = this.admins[0];

  await this.save();

  return false;
};

groupSchema.pre("remove", async function (next) {
  try {
    await this.populate({
      path: "messages",
      select: "files",
      populate: [{ path: "files", select: "path" }],
    });

    const paths = getFiles(this);
    for (const path of paths) fs.unlink(path, (err) => console.log(err));

    next();
  } catch (err) {
    next(err);
  }
});

groupSchema.pre("deleteMany", async function (next) {
  try {
    const groups = await Group.find(this._conditions)
      .populate({
        path: "messages",
        select: "files",
        populate: [{ path: "files", select: "path" }],
      })
      .lean();

    const paths = groups.reduce((files, group) => {
      files.push(getFiles(group));
      return files;
    }, []);

    for (const path of paths) fs.unlink(path, (err) => console.log(err));

    next();
  } catch (err) {
    next(err);
  }
});

const Group = mongoose.model("Group", groupSchema);
module.exports = Group;
