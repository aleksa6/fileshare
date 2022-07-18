exports.message = (req, res, pageTitle, message, isSuccess) => {
  req.flash("message", { pageTitle, message, isSuccess });
  req.session.save((err) => {
    res.redirect("/message");
  });
};
