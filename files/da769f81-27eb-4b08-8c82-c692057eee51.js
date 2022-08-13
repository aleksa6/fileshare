const path = require("path");

const express = require("express");
const multer = require("multer");
const { v4 } = require("uuid");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "test");
  },
  filename: (req, file, cb) => {
    const name = `${v4()}.${file.originalname.split(".").slice(-1)}`;
    cb(null, name);

    req.on("aborted", () => {
      console.log("aborted");
      file.stream.on("end", async () => {
        await fs.unlink(path.join(__dirname, "..", "files", name), (err) =>
          console.log(err)
        );
      });
      file.stream.emit("end");
    });
  },
});

const upload = multer({ storage: fileStorage });

app.post(
  "/",
  async (req, res, next) => {
    console.log(req.ip);
    next();
  },
  upload.any(),
  async (req, res, next) => {
    console.log(req.files);
    res.json({ file: req.files });
  }
);

app.listen(3000);
