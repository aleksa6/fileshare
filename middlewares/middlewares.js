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

      uploads.push([saveTo, fstream, info.filename, info.mimeType]);

      file.pipe(fstream);

      file.on("end", async () => {
        const fileData = uploads.splice(
          uploads.find((upload) => upload.saveTo === saveTo),
          1
        );
        req.files.push({
          path: fileData[0][0],
          filename: fileData[0][2],
          mimetype: fileData[0][3],
        });
      });
    });
    bb.on("close", () => {
      done = true;
      next();
    });
    req.on("close", (err) => {
      setImmediate(() => {
        if (!done) {
          if (uploads.length > 0) {
            uploads.forEach(async (upload) => {
              upload[1].end();
              await fs.unlink(upload[0], (err) => {
                if (err) return next(err);
              });
            });
          }
        }
      });
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
