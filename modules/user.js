let User = syzoj.model('user');
const RatingCalculation = syzoj.model('rating_calculation');
const RatingHistory = syzoj.model('rating_history');
const Contest = syzoj.model('contest');
const ContestPlayer = syzoj.model('contest_player');

// Ranklist
app.get('/ranklist', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', {'登录': syzoj.utils.makeUrl(['login'], {'url': req.originalUrl})});
    if (!res.locals.user.is_available) throw new ErrorMessage('您没有权限，请联系管理员授权。');
    const sort = req.query.sort || syzoj.config.sorting.ranklist.field;
    const order = req.query.order || syzoj.config.sorting.ranklist.order;
    if (!['ac_num', 'rating', 'id', 'username'].includes(sort) || !['asc', 'desc'].includes(order)) {
      throw new ErrorMessage('错误的排序参数。');
    }
    let paginate = syzoj.utils.paginate(await User.countForPagination({is_show: true}), req.query.page, syzoj.config.page.ranklist);
    let ranklist = await User.queryPage(paginate, {is_show: true}, {[sort]: order.toUpperCase()});
    await ranklist.forEachAsync(async x => x.renderInformation());

    res.render('ranklist', {
      ranklist: ranklist,
      paginate: paginate,
      curSort: sort,
      curOrder: order === 'asc'
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/find_user', async (req, res) => {
  try {
    let user = await User.fromName(req.query.nickname);
    if (!user) throw new ErrorMessage('无此用户。');
    res.redirect(syzoj.utils.makeUrl(['user', user.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

// userlist
app.get('/userlist', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', {'登录': syzoj.utils.makeUrl(['login'], {'url': req.originalUrl})});
    if (!res.locals.user.is_available) throw new ErrorMessage('您没有权限，请联系管理员授权。');
    const sort = req.query.sort || syzoj.config.sorting.userlist.field;
    const order = req.query.order || syzoj.config.sorting.userlist.order;
    if (!['register_time', 'id', 'username'].includes(sort) || !['asc', 'desc'].includes(order)) {
      throw new ErrorMessage('错误的排序参数。');
    }
    let paginate = syzoj.utils.paginate(await User.countForPagination({is_show: true}), req.query.page, syzoj.config.page.userlist);
    let userlist = await User.queryPage(paginate, {is_show: true}, {[sort]: order.toUpperCase()});
    await userlist.forEachAsync(async x => x.renderInformation());

    res.render('userlist', {
      userlist: userlist,
      paginate: paginate,
      curSort: sort,
      curOrder: order === 'asc'
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

// Login
app.get('/login', async (req, res) => {
  if (res.locals.user) {
    res.render('error', {
      err: new ErrorMessage('您已经登录了，请先注销。', {'注销': syzoj.utils.makeUrl(['logout'], {'url': req.originalUrl})})
    });
  } else {
    res.render('login');
  }
});

// Sign up
app.get('/sign_up', async (req, res) => {
  if (res.locals.user) {
    res.render('error', {
      err: new ErrorMessage('您已经登录了，请先注销。', {'注销': syzoj.utils.makeUrl(['logout'], {'url': req.originalUrl})})
    });
  } else {
    res.render('sign_up');
  }
});

// Logout
app.post('/logout', async (req, res) => {
  req.session.user_id = null;
  res.clearCookie('login');
  res.redirect(req.query.url || '/');
});

// User page
app.get('/user/:id', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', {'登录': syzoj.utils.makeUrl(['login'], {'url': req.originalUrl})});
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');
    user.ac_problems = await user.getACProblems();
    user.articles = await user.getArticles();
    user.allowedEdit = await user.isAllowedEditBy(res.locals.user);

    let statistics = await user.getStatistics();
    await user.renderInformation();
    user.emailVisible = user.public_email || user.allowedEdit;

    const ratingHistoryValues = await RatingHistory.find({
      where: {user_id: user.id},
      order: {rating_calculation_id: 'ASC'}
    });
    const ratingHistories = [{
      contestName: "初始积分",
      value: syzoj.config.default.user.rating,
      delta: null,
      rank: null
    }];

    for (const history of ratingHistoryValues) {
      const contest = await Contest.findById((await RatingCalculation.findById(history.rating_calculation_id)).contest_id);
      ratingHistories.push({
        contestName: contest.title,
        value: history.rating_after,
        delta: history.rating_after - ratingHistories[ratingHistories.length - 1].value,
        rank: history.rank,
        participants: await ContestPlayer.count({contest_id: contest.id})
      });
    }
    ratingHistories.reverse();

    res.render('user', {
      show_user: user,
      statistics: statistics,
      ratingHistories: ratingHistories
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/user/:id/edit', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    user.privileges = await user.getPrivileges();

    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: null
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/forget', async (req, res) => {
  res.render('forget');
});


app.post('/user/:id/edit', async (req, res) => {
  let user;
  try {
    let id = parseInt(req.params.id);
    user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) throw new ErrorMessage('您没有权限进行此操作。');

    if (req.body.old_password && req.body.new_password) {
      if (user.password !== req.body.old_password && !await res.locals.user.hasPrivilege('manage_user')) throw new ErrorMessage('旧密码错误。');
      user.password = req.body.new_password;
    }

    if (res.locals.user && await res.locals.user.hasPrivilege('manage_user')) {
      if (!syzoj.utils.isValidUsername(req.body.username)) throw new ErrorMessage('无效的用户名。');
      user.username = req.body.username;
      user.email = req.body.email;
      user.level = parseInt(req.body.level) || 0;
    }

    if (res.locals.user && res.locals.user.is_admin) {
      if (!req.body.privileges) {
        req.body.privileges = [];
      } else if (!Array.isArray(req.body.privileges)) {
        req.body.privileges = [req.body.privileges];
      }

      let privileges = req.body.privileges;
      await user.setPrivileges(privileges);
    }

    if (res.locals.user && !user.is_admin && await res.locals.user.hasPrivilege('manage_user')) {
      user.is_available = (req.body.is_available === 'on');
    }

    if (res.locals.user && res.locals.user.is_admin) {
      user.download_data = (req.body.download_data === 'on');
    }

    user.nickname = req.body.nickname;
    user.information = req.body.information;
    user.sex = req.body.sex;
    user.public_email = (req.body.public_email === 'on');
    user.prefer_formatted_code = (req.body.prefer_formatted_code === 'on');

    await user.save();

    if (user.id === res.locals.user.id) res.locals.user = user;

    user.privileges = await user.getPrivileges();
    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: ''
    });
  } catch (e) {
    user.privileges = await user.getPrivileges();
    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: e.message
    });
  }
});

app.post('/user/:id/delete', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    if (user.is_admin) throw new ErrorMessage('您不能删除管理员账户。');
    if (!user.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');

    //await user.delete();
    user.is_show = false;
    user.is_available = false;
    await user.save();

    res.redirect('/');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});
