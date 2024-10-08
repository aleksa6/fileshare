const path = require("path");
const fs = require("fs");

const { check } = require("express-validator");
const mime = require("mime-types");
const rateLimit = require("express-rate-limit");
const router = require("express").Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const groupController = require("../controllers/groups");
const { isAuth } = require("../middlewares/middlewares");

const joinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login requests made",
});

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "files"));
  },
  filename: (req, file, cb) => {
    let name = uuidv4();
    const ext = path.extname(file.originalname).trim();
    if (ext.length) name = name + ext;

    cb(null, name);

    req.on("aborted", () => {
      file.stream.on("end", async () => {
        fs.unlink(path.join(__dirname, "..", "files", name), (err) =>
          console.log(err)
        );
      });
      file.stream.emit("end");
    });
  },
});

const upload = multer({ storage: fileStorage });

router.get("/", groupController.homePage);

router.get("/join", groupController.getJoin);

router.post(
  "/join",
  joinLimiter,
  [
    check("code")
      .trim()
      .isLength({ min: 8, max: 8 })
      .withMessage("Group IDs contain 8 characters"),
    check("password")
      .trim()
      .not()
      .isEmpty()
      .withMessage("You have to enter password"),
  ],
  groupController.postJoin
);

router.get("/create-group", isAuth, groupController.getCreateGroup);

router.post("/leave-group", groupController.leaveGroup);

router.post(
  "/create-group",
  [
    check("name")
      .trim()
      .not()
      .isEmpty()
      .withMessage("Name should not be empty")
      .isLength({ max: 20 })
      .withMessage("Name should not be longer than 20 characters"),
    check("description")
      .trim()
      .not()
      .isEmpty()
      .withMessage("Description should not be empty"),
    check("password")
      .trim()
      .not()
      .isEmpty()
      .withMessage("Password can't be empty")
      .isLength({ min: 8 })
      .withMessage("Password should be at least 8 characters long"),
    check("passwordConf")
      .trim()
      .isLength({ min: 8 })
      .custom((value, { req }) => {
        if (value !== req.body.password)
          throw new Error("Passwords do not match");
        return true;
      }),
  ],
  groupController.postCreateGroup
);

router.post("/delete-group", groupController.deleteGroup);

router.get("/groups", isAuth, groupController.getGroups);

router.get("/groups/:groupId", groupController.getGroup);

router.get("/file/:fileId", groupController.download);

router.post(
  "/send-message",
  isAuth,
  upload.any(),
  check("description")
    .trim()
    .not()
    .isEmpty()
    .withMessage("You must provide description"),
  groupController.sendMessage
);

router.get("/groups/:groupId/members", groupController.getMembers);

router.post("/remove", groupController.removeUser);

router.post("/add-admin", groupController.addAdmin);

router.post("/remove-admin", groupController.removeAdmin);

router.get(
  "/groups/:groupId/:username/personal-storage",
  groupController.getPersonalStorage
);

router.post(
  "/groups/:groupId/:username/personal-storage/upload",
  groupController.uploadToStorage
);

router.get("/message", groupController.message);

module.exports = router;
