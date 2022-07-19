const crypto = require("crypto");

const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const groupSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  password: { type: String, required: true },
  code: String,
  admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
  files: [{ type: Schema.Types.ObjectId, ref: "File" }],
});

groupSchema.pre("save", async function () {
  const code = await crypto.randomBytes(4);
  this.code = code.toString("hex");
});

module.exports = mongoose.model("Group", groupSchema);
