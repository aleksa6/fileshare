const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const fileSchema = new Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  mimetype: { type: String, required: true },
  message: { type: Schema.Types.ObjectId, ref: "Message" },
});

module.exports = mongoose.model("File", fileSchema);
