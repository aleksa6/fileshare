const fs = require("fs");

const mongoose = require("mongoose");

exports.message = (req, res, pageTitle, message, isSuccess) => {
  req.flash("message", { pageTitle, message, isSuccess });
  req.session.save((err) => {
    res.redirect("/message");
  });
};

exports.isMember = (req, group) => {
  if (!req.session?.isInGroup && !req.session?.isLoggedIn) return false;
  if (
    !req.session?.isLoggedIn &&
    req.session?.isInGroup &&
    req.session.group._id.toString() !== group._id.toString()
  )
    return false;
  if (
    req.session?.isLoggedIn &&
    group.participants.find(
      (userId) => userId.toString() === req.session?.user._id.toString()
    ) == null
  )
    return false;
  return true;
};

exports.isValid = (ID) => mongoose.Types.ObjectId.isValid(ID);

exports.isAdmin = (req, group) =>
  req.session?.isLoggedIn &&
  group.admins.find(
    (userId) => userId.toString() === req.session?.user._id.toString()
  ) != null;

exports.updateNames = (name) => {
  const userName = name.toLowerCase();
  const variables = JSON.parse(fs.readFileSync("variables.json"));
  if (variables.names[userName] == null) variables.names[userName] = 0;
  const id = ++variables.names[userName];
  fs.writeFileSync("variables.json", JSON.stringify(variables));
  return id;
};

exports.error = (title, message) => {
  const error = new Error(message);
  error.title = title;
  throw error;
};

exports.flat = (arr) => {
  if (arr.every(el => !Array.isArray(el))) return arr
  
  const res = []
  
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      res.push(...this.flat(arr[i]))
    } else {
      res.push(arr[i])
    }
  }
  
  return res
}
