const path = require("path");
const fs = require("fs");

const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const { message } = require("../util/util");
const Group = require("../models/group");
const User = require("../models/user");
const File = require("../models/file");

// FUNCTIONS

const isMember = (req, group) =>
  !(
    // cheks if logged in user is a member of the group
    (
      (req.session.isLoggedIn &&
        !req.session.user.groups.find(
          (groupId) => groupId.toString() === group._id.toString()
        ) === -1) ||
      // checks if the guest user who is in a group has access to the desired group
      (req.session.isInGroup &&
        req.session.group._id.toString() !== group._id.toString()) ||
      // checks if the user is neither logged in nor is member of a group
      (!req.session.isInGroup && !req.session.isLoggedIn)
    )
  );

const isValid = (id) => mongoose.Types.ObjectId.isValid(id);

const error = (title, message) => {
  const error = new Error(message);
  error.title = title;
  throw error;
};

// MIDDLEWARES

exports.homePage = async (req, res, next) => {
  try {
    res.render("main/home", {
      pageTitle: "Home",
    });
  } catch (err) {
    next(err);
  }
};

exports.getJoin = async (req, res, next) => {
  try {
    const errors = req.flash("error");
    const message = req.flash("message");

    res.render("main/join", {
      pageTitle: "Join Group",
      error: errors[0]?.message,
      message: message[0] || null,
      oldInput: errors[0]?.oldInput,
      fields: errors[0]?.fields,
    });
  } catch (err) {
    next(err);
  }
};

exports.postJoin = async (req, res, next) => {
  try {
    const { code, password } = req.body;

    const group = await Group.findOne({ code });
    if (group == null) {
      req.flash("error", {
        message: "Could not find a group with this ID",
        oldInput: { code, password },
        fields: ["code"],
      });

      return req.session.save((err) => {
        res.redirect("/join");
      });
    }

    const isEqual = await bcrypt.compare(password, group.password);
    if (!isEqual) {
      req.flash("error", {
        message: "Wrong password",
        oldInput: { code, password },
        fields: ["password"],
      });

      return req.session.save((err) => {
        res.redirect("/join");
      });
    }

    if (req.session.isLoggedIn) {
      const user = await User.findById(req.session.user._id);
      if (user != null && !user.groups.includes(group._id)) {
        user.groups.push(group._id);
        await user.save();
      }
    } else {
      req.session.isInGroup = true;
      req.session.group = group;
    }

    req.session.save((err) => {
      res.redirect(`/groups/${group._id.toString()}`);
    });
  } catch (err) {
    next(err);
  }
};

exports.getCreateGroup = async (req, res, next) => {
  try {
    const errors = req.flash("error");

    res.render("main/create-group", {
      pageTitle: "Create Group",
      error: errors[0]?.message,
      oldInput: errors[0]?.oldInput,
      fields: errors[0]?.fields,
    });
  } catch (err) {
    next(err);
  }
};

exports.postCreateGroup = async (req, res, next) => {
  try {
    const { name, password, passwordConf, adminPassword, adminPasswordConf } =
      req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", {
        message: errors.array()[0].msg,
        oldInput: {
          name,
          password,
          passwordConf,
          adminPassword,
          adminPasswordConf,
        },
        fields: errors.array().map((err) => err.param),
      });
      return req.session.save((err) => {
        res.redirect("/create-group");
      });
    }

    const hashedPw = await bcrypt.hash(password, 12);
    const hashedAdminPw = await bcrypt.hash(adminPassword, 12);
    const group = await Group.create({
      name,
      password: hashedPw,
      adminPassword: hashedAdminPw,
      files: [],
    });

    if (req.session.isLoggedIn) {
      const user = await User.findById(req.session.user._id);
      if (user != null) {
        user.groups.push(group._id);
        await user.save();
      }
    }

    message(req, res, "Group Created", "Group successfully created", true);
  } catch (err) {
    next(err);
  }
};

exports.message = async (req, res, next) => {
  try {
    const messageObj = req.flash("message")[0];

    res.render("main/message", {
      pageTitle: messageObj?.pageTitle,
      message: messageObj?.message,
      isSuccess: messageObj?.isSuccess,
    });
  } catch (err) {
    next(err);
  }
};

exports.getGroups = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user._id)
      .lean()
      .populate("groups", "name");

    if (!user)
      message(
        req,
        res,
        "Invalid User",
        "Could not fetch groups because user with this ID could not be found",
        false
      );

    res.render("main/groups", {
      pageTitle: "My Groups",
      groups: user.groups,
    });
  } catch (err) {
    next(err);
  }
};

exports.getGroup = async (req, res, next) => {
  try {
    const groupId = req.params.groupId;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return message(
        req,
        res,
        "Invalid Param",
        "Could not find a group with the id from url",
        false
      );
    }

    const group = await Group.findById(groupId).populate("files").lean();

    if (group == null)
      return message(
        req,
        res,
        "Invalid Param",
        "Could not find a group with the id from url",
        false
      );

    if (!isMember(req, group))
      return message(
        req,
        res,
        "Access Denied",
        "You cannot access this group because you are not the member",
        false
      );

    res.render("main/group", {
      pageTitle: group.name,
      group: group,
    });
  } catch (err) {
    next(err);
  }
};

exports.upload = async (req, res, next) => {
  console.log("START");
  try {
    const groupId = req.body.groupId;
    console.log("HERE 0");
    if (!isValid(groupId)) error("Invalid ID", "Group ID is invalid");
    console.log("HERE 1");
    const group = await Group.findById(groupId);
    console.log("HERE 2");
    if (group == null) error("Group Not Found", "Could not find a group");
    console.log("HERE 3");
    if (!isMember(req, group))
      error(
        "Access Denied",
        "You have to be a member of the group to be able to download and share files"
      );
    console.log("HERE 4");
    for (const fileData of req.files) {
      console.log(fileData);

      const file = await File.create({
        filename: fileData.originalname,
        mimetype: fileData.mimetype,
        path: path.join(require.main.filename, fileData.path),
        group: group._id,
      });

      console.log(file);

      group.files.push(file._id);
    }

    await group.save();

    res.redirect(`/group/${group._id.toString()}`);
  } catch (err) {
    next(err);
  }
};

exports.download = async (req, res, next) => {
  try {
    const file = await File.findById(req.params.fileId);

    if (!file) {
      return message(
        req,
        res,
        "File Not Found",
        "Could not download file because file could not be found",
        false
      );
    }

    if (!isMember(req, { _id: file.group._id }))
      return message(
        req,
        res,
        "Access Denied",
        "You are not the member of the group where is this file shared",
        false
      );

    const fstream = fs.createReadStream(file.path);
    res.setHeader("Content-Type", file.mimetype);
    res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
    fstream.pipe(res);
  } catch (err) {
    next(err);
  }
};
