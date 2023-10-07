const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const fileSchema = new Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  mimetype: { type: String, required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group" },
});

module.exports = mongoose.model("File", fileSchema);
