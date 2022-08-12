const mongoose = require("mongoose");

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

module.exports = mongoose.model("Group", groupSchema);
