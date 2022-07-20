const path = require("path");
const fs = require("fs");

const { v4: uuidv4 } = require("uuid");
const busboy = require("busboy");

exports.upload = async (req, res, next) => {
  try {
    const bb = busboy({ headers: req.headers });
    req.files = [];
    let uploads = [];
    let done = false;

    bb.on("field", (name, value, info) => {
      req.body[name] = value;
    });

    bb.on("file", (name, file, info) => {
      if (info.filename == null) return next();

      const saveTo = path.join(
        require.main.path,
        "files",
        `${uuidv4()}.${info.filename.split(".").slice(-1)}`
      );

      const fstream = fs.createWriteStream(saveTo);

      const fileData = {
        path: saveTo,
        fstream,
        filename: info.filename,
        mimetype: info.mimeType,
      };

      uploads.push(fileData);

      file.pipe(fstream);

      file.on("end", async () => {
        const fileData = uploads.pop();

        req.files.push({
          path: fileData.path,
          filename: fileData.filename,
          mimetype: fileData.mimetype,
        });
      });
    });

    bb.on("close", () => {
      done = true;
      next();
    });

    const abortHandler = async () => {
      if (!done && uploads.length > 0) {
        for (const upload of uploads) {
          upload.fstream.end();
          await fs.unlink(upload.path, (err) => {
            if (err) return next(err);
          });
        }
      }
    };

    req.on("close", (err) => {
      setImmediate(abortHandler);
    });

    req.pipe(bb);
  } catch (err) {
    next(err);
  }
};

exports.isAuth = async (req, res, next) => {
  try {
    if (req.session.isLoggedIn) {
      return next();
    }

    req.flash("message", {
      pageTitle: "Not Authorized",
      message: "You have to be logged in in order to perform this action",
      isSuccess: false,
    });
    req.session.save((err) => {
      res.redirect("/message");
    });
  } catch (err) {
    next(err);
  }
};
