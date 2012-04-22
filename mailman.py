import sys
sys.path.append('/usr/lib/mailman')
from Mailman import MailList

class UserDesc:
  def __init__(self, userTitle, email):
    self.fullname = userTitle
    self.address = email

def getMembers(mlist):
  members = mlist.getRegularMemberKeys()
  for member in members:
    print member

def addMember(mlist, userTitle, email):
  userdesc = UserDesc(userTitle, email)
  mlist.Lock()
  mlist.ApprovedAddMember(userdesc, ack=True, admin_notif=False)
  mlist.Save()
  mlist.Unlock()

def delMember(mlist, email):
  mlist.Lock()
  mlist.DeleteMember(email, userack=True, admin_notif=False)
  mlist.Save()
  mlist.Unlock()

def getAdmins(mlist):
  for admin in mlist.owner:
    print admin

def addAdmin(mlist, email):
  mlist.Lock()
  mlist.owner.append(email)
  mlist.Save()
  mlist.Unlock()

def delAdmin(mlist, email):
  mlist.Lock()
  mlist.owner.remove(email)
  mlist.Save()
  mlist.Unlock()

def main():
  args = sys.argv[1:]
  method = args[0]
  listname = args[1]
  
  mlist = MailList.MailList(listname, lock=False)
  try:
    if method == 'getmembers':
      getMembers(mlist)
    elif method == 'addmember':
      addMember(mlist, args[2], args[3])
    elif method == 'delmember':
      delMember(mlist, args[2])
    elif method == 'getadmins':
      getAdmins(mlist)
    elif method == 'addadmin':
      addAdmin(mlist, args[2])
    elif method == 'deladmin':
      delAdmin(mlist, args[2])
  except Exception, e:
    mlist.Unlock()
    print e

if __name__ == '__main__':
  main()
