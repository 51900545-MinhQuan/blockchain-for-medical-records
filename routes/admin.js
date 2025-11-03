const express = require("express");
const fs = require("fs");
const router = express.Router();

// Import Model
const UserModel = require("../models/user");

/*
|------------------------------------------------------------------------------------------------------
| TRANG TỔNG QUAN
|------------------------------------------------------------------------------------------------------
*/

router.get("/", async (req, res, next) => {
  try {
    var user = req.session.user;
    return res.render("admin/index", {
      code: 0,
      message: "Ok",
      user,
      errors: req.flash("errors"),
      success: req.flash("success"),
    });
  } catch (error) {
    return res
      .status(500)
      .render("error", {
        error: {
          status: 500,
          stack: "Unable to connect to the system, please try again!",
        },
        message: "Connection errors",
      });
  }
});

module.exports = router;
