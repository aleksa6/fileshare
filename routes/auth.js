const express = require("express");
const { check } = require("express-validator");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const User = require("../models/user");
const authController = require("../controllers/auth");
const { isAuth } = require("../middlewares/middlewares");

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login requests made",
});

router.get("/signup", authController.getSignup);

router.post(
  "/signup",
  [
    check("name")
      .trim()
      .isLength({ min: 2, max: 28 })
      .withMessage("Name should contain from 2 to 28 characters"),
    check("email")
      .isEmail()
      .normalizeEmail()
      .trim()
      .withMessage("Please enter a valid email")
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("E-Mail address already exists");
          }
        });
      }),
    check("password")
      .trim()
      .not()
      .isEmpty()
      .withMessage("Password can't be empty")
      .isLength({ min: 8 })
      .withMessage("Password should be at least 8 characters long"),
    check("passwordConf")
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password)
          throw new Error("Passwords do not match");
        return true;
      }),
  ],
  authController.postSignup
);

router.get("/login", authController.getLogin);

router.post(
  "/login",
  [
    check("email")
      .isEmail()
      .normalizeEmail()
      .trim()
      .withMessage("Please enter a valid email"),
    check("password")
      .trim()
      .not()
      .isEmpty()
      .withMessage("You must enter password"),
  ],
  loginLimiter,
  authController.postLogin
);

router.get("/reset", authController.getReset);

router.post(
  "/reset",
  [
    check("email")
      .isEmail()
      .normalizeEmail()
      .trim()
      .withMessage("Please enter a valid email"),
  ],
  authController.postReset
);

router.get("/new-password/:token", authController.getNewPassword);

router.post(
  "/new-password",
  [
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
  authController.postNewPassword
);

router.get("/logout", isAuth, authController.logout);

router.get("/delete-account", isAuth, authController.deleteAccount);

module.exports = router;
