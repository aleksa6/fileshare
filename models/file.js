const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const fileSchema = new Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    sharedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("File", fileSchema);
