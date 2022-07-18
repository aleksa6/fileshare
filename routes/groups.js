const express = require("express");
const { check } = require("express-validator");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const groupController = require("../controllers/groups");
const { upload, isAuth } = require("../middlewares/middlewares");

const joinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login requests made",
});

router.get("/", groupController.homePage);

router.get("/join", groupController.getJoin);

router.post("/join", joinLimiter, groupController.postJoin);

router.get("/create-group", groupController.getCreateGroup);

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
    check("password")
      .trim()
      .isLength({ min: 8 })
      .withMessage("Password should be at least 8 characters long"),
    check("adminPassword")
      .trim()
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
    check("adminPasswordConf")
      .trim()
      .isLength({ min: 8 })
      .custom((value, { req }) => {
        if (value !== req.body.adminPassword)
          throw new Error("Admin passwords do not match");
        return true;
      }),
  ],
  groupController.postCreateGroup
);

router.get("/groups", isAuth, groupController.getGroups);

router.get("/group/:groupId", groupController.getGroup);

router.get("/file/:fileId", groupController.download);

router.post("/share-file", upload, groupController.upload);

router.get("/message", groupController.message);

module.exports = router;
