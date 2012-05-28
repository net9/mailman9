var events = require('events');
var util = require('util');
var child_process = require('child_process');
var fs = require('fs');
var config = require('./config');

function Mailman9 () {
  events.EventEmitter.call(this);
}

util.inherits(Mailman9, events.EventEmitter);

Mailman9.prototype.addNewList = function (listName, callback) {
  if (listName == 'root') {
    return callback();
  }
  writeLog('New list: ' + listName);
  var cmd = 'newlist --language=zh_CN --quiet ' + listName + ' '
    + this.rootAdminEmail + ' ' + config.defaultMailListPassword;
  var listsCmd = child_process.exec(cmd, function (err) {
    callback(err);
  });
};

Mailman9.prototype.removeList = function (listName, callback) {
  writeLog('Delete list: ' + listName);
  var cmd = 'rmlist ' + listName;
  var listsCmd = child_process.exec(cmd, function (err) {
    callback(err);
  });
};

Mailman9.prototype.addAdmin = function (listName, email, callback) {
  writeLog('Add admin: ' + listName + ' ' + email);
  var cmd = 'python mailman.py addadmin ' + listName + ' ' + email;
  var listsCmd = child_process.exec(cmd, function (err) {
    callback(err);
  });
};

Mailman9.prototype.delAdmin = function (listName, email, callback) {
  writeLog('Delete admin: ' + listName + ' ' + email);
  var cmd = 'python mailman.py deladmin ' + listName + ' ' + email;
  var listsCmd = child_process.exec(cmd, function (err) {
    callback(err);
  });
};

Mailman9.prototype.addMember = function (listName, fullname, email, callback) {
  writeLog('Add member: ' + listName + ' ' + email);
  var cmd = 'python mailman.py addmember ' + listName + ' ' + fullname + ' ' + email;
  var listsCmd = child_process.exec(cmd, function (err) {
    callback(err);
  });
};

Mailman9.prototype.delMember = function (listName, email, callback) {
  writeLog('Delete member: ' + listName + ' ' + email);
  var cmd = 'python mailman.py delmember ' + listName + ' ' + email;
  var listsCmd = child_process.exec(cmd, function (err) {
    callback(err);
  });
};

var mailman9 = module.exports = new Mailman9();

mailman9.on('data', function (data) {
  if (data.error) {
    return writeLog(data.error);
  }
  var groups = {};
  data.groups.forEach(function (group) {
    if (group.name == 'root') {
      return;
    }
    groups[group.name] = group;
  });
  var users = {};
  data.users.forEach(function (user) {
    user.email = user.email.toLowerCase();
    users[user.name] = user;
    user.allGroups.forEach(function (group) {
      if (group.name == 'root') {
        return;
      }
      if (!groups[group.name].allUsers) {
        groups[group.name].allUsers = [];
      }
      groups[group.name].allUsers.push(user.name);
    });
    if (user.name == 'net9') {
      mailman9.rootAdminEmail = user.email;
    }
  });
  mailman9.users = data.users;
  mailman9.groups = data.groups;
  mailman9.usersMap = users;
  mailman9.groupsMap = groups;
  mailman9.emit('lists');
});

mailman9.on('lists', function () {
  var listsCmd = child_process.exec('list_lists -b', function (err, stdout) {
    if (err) {
      return writeLog(err);
    }
    var lists = stdout.split('\n');
    lists = lists.slice(0, lists.length - 1);
    mailman9.existingLists = lists;
    mailman9.emit('addnewlists');
  });
});

mailman9.on('addnewlists', function () {
  var existingListsMap = {};
  mailman9.existingLists.forEach(function (listName) {
    existingListsMap[listName] = true;
  });
  var done = 0;
  mailman9.groups.forEach(function (group) {
    if (!existingListsMap[group.name]) {
      mailman9.addNewList(group.name, function (err) {
        if (err) {
          writeLog(err);
        }
        done ++;
        if (done == mailman9.groups.length) {
          mailman9.emit('removeoldlists');
        }
      });
    } else {
      done ++;
    }
  });
  if (done == mailman9.groups.length) {
    mailman9.emit('removeoldlists');
  }
});

mailman9.on('removeoldlists', function () {
  var done = 0;
  mailman9.existingLists.forEach(function (listName) {
    if (listName == 'mailman') {
      done ++;
      return;
    }
    if (!mailman9.groupsMap[listName]) {
      mailman9.removeList(listName, function (err) {
        if (err) {
          writeLog(err);
        }
        done ++;
        if (done == mailman9.existingLists.length) {
          mailman9.emit('synclists');
        }
      });
    } else {
      done ++;
    }
  });
  if (done == mailman9.existingLists.length) {
    mailman9.emit('synclists');
  }
});

mailman9.on('synclists', function () {
  mailman9.groups.forEach(function (group) {
    if (group.name == 'root') {
      return;
    }
    mailman9.emit('addnewlistadmin', group);
  });
});

mailman9.on('addnewlistadmin', function (group) {
  var cmd = 'python mailman.py getadmins ' + group.name;
  var listsCmd = child_process.exec(cmd, function (err, stdout) {
    var existingAdmins = stdout.split('\n');
    existingAdmins = existingAdmins.slice(0, existingAdmins.length - 1);
    var done = 0;
    group.allAdmins.forEach(function (adminName) {
      var user = mailman9.usersMap[adminName];
      if (!user.email) {
        return writeLog('Error: No email address in ' + user.name);
      }
      var adminEmail = user.email.toLowerCase();
      if (!inArray(existingAdmins, adminEmail)) {
        // not in existing admins
        mailman9.addAdmin(group.name, adminEmail, function (err) {
          if (err) {
            writeLog(err);
          }
          done++;
          if (done == group.allAdmins.length) {
            mailman9.emit('deloldlistadmin', group, existingAdmins);
          }
        });
      } else {
        done++;
      }
    });
    if (done == group.allAdmins.length) {
      mailman9.emit('deloldlistadmin', group, existingAdmins);
    }
  });
});

mailman9.on('deloldlistadmin', function (group, existingAdmins) {
  var allEmails = group.allAdmins.map(function (adminName) {
    return mailman9.usersMap[adminName].email;
  });
  var done = 0;
  existingAdmins.forEach(function (adminEmail) {
    if (!inArray(allEmails, adminEmail)) {
      // existing admin not in admins
      mailman9.delAdmin(group.name, adminEmail, function (err) {
        if (err) {
          writeLog(err);
        }
        done++;
        if (done == existingAdmins.length) {
          mailman9.emit('addnewlistmember', group);
        }
      });
    } else {
      done++;
    }
  });
  if (done == existingAdmins.length) {
    mailman9.emit('addnewlistmember', group);
  }
});

mailman9.on('addnewlistmember', function (group) {
  var cmd = 'python mailman.py getmembers ' + group.name;
  var listsCmd = child_process.exec(cmd, function (err, stdout) {
    var existingMembers = stdout.split('\n');
    existingMembers = existingMembers.slice(0, existingMembers.length - 1);
    var done = 0;
    if (!group.allUsers) {
      group.allUsers = [];
    }
    group.allUsers.forEach(function (userName) {
      var user = mailman9.usersMap[userName];
      if (!user.email) {
        return writeLog('Error: No email address in ' + user.name);
      }
      var userEmail = user.email.toLowerCase();
      if (!inArray(existingMembers, userEmail)) {
        // not in existing members
        mailman9.addMember(group.name, user.fullname, userEmail, function (err) {
          if (err) {
            writeLog(err);
          }
          done++;
          if (done == group.allUsers.length) {
            mailman9.emit('deloldlistmember', group, existingMembers);
          }
        });
      } else {
        done++;
      }
    });
    if (done == group.allUsers.length) {
      mailman9.emit('deloldlistmember', group, existingMembers);
    }
  });
});

mailman9.on('deloldlistmember', function (group, existingMembers) {
  var allEmails = group.allUsers.map(function (userName) {
    return mailman9.usersMap[userName].email;
  });
  existingMembers.forEach(function (userName) {
    if (!inArray(allEmails, userName)) {
      // existing member not in users
      mailman9.delMember(group.name, userName, function (err) {
        if (err) {
          writeLog(err);
        }
      });
    }
  });
});

function inArray (arr, elem) {
  for (var i in arr) {
    if (arr[i] === elem) {
      return true;
    }
  }
  return false;
}


var logFile = fs.createWriteStream(config.logFile, {flags: 'a'});
function writeLog (error) {
  logFile.write('[' + new Date() + '] ' + error + '\n');
  console.log(error);
}
