const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const path = require('path');
const connectDB = require('./config/db');
const fileUpload = require('express-fileupload');
const {
  setUserStatus,
  getUserStatus,
  unFriend,
  getUserById,
  updateUser,
} = require('./controllers/user');
const {
  createUser,
  login,
  getUsers,
  addFriend,
  getFriends,
  sendMessage,
  getMessages,
} = require('./controllers/user');
const {
  createGroup,
  getGoups,
  getGroupMessages,
  createGroupMessage,
  leave_remove_group,
} = require('./controllers/group');
const { uploadRouter } = require('./routes/upload');
const dotenv = require('dotenv').config();
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: ['http://localhost:3000'],
  },
});
// upload files
app.use(fileUpload());
app.use('/', uploadRouter);
const PORT = process.env.PORT || 5000;
// connect to database
connectDB();
// serve files for production
if (process.env.NODE_ENV === 'production') {
  console.log('Server run in production');
  app.use(express.static(path.join(__dirname, '../client/build')));
  // redirect if the user hit another api
  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, '..', 'client', 'build', 'index.html'))
  );
}
io.on('connection', socket => {
  //get user by Id
  socket.on('getUserById', async userId => {
    const res = await getUserById(userId);
    socket.emit('getUserByIdResponse', res);
  });
  // get user status
  socket.on('getUserStatus', async userId => {
    const status = await getUserStatus(userId);
    socket.emit('userStatus', status);
    console.log(status);
  });
  // set user to active as it login
  socket.on('setUserToActive', async ({ userId, status }) => {
    const res = await setUserStatus(userId, status);
    console.log(res);
  });
  // update user
  socket.on('updateUser', async ({ userId, data }) => {
    const res = await updateUser(userId, data);

    socket.emit('updateUserResponse', res);
  }); 
  // delete user from a group or delete the gorup if he is an admin
  socket.on('deleteGroup', async ({ userId, groupId }) => {
    const res = await leave_remove_group(groupId, userId);

    const groups = await getGoups(userId);
    io.emit('getGroupsResponse', groups);
  });

  socket.on(
    'chatMessage',
    async ({ friendId, userId, text, room, groupId }) => {
      if (!groupId) {
        const response = await sendMessage(friendId, userId, text);

        const messagesResponse = await getMessages(userId, friendId);
        // console.log(messagesResponse);

        io.to(room).emit('message', messagesResponse);
      } else {
        // send send message to group chat
        const res = await createGroupMessage(groupId, userId, text);
        io.to(room).emit('message', res);
      }
    }
  );
  // register a user
  socket.on('register', async data => {
    const response = await createUser(data);
    socket.emit('registerResponse', response);
    // update all users list
    const users = await getUsers();
    socket.emit('getUsersResponse', users);
  });
  // login
  socket.on('login', async data => {
    console.log(data);
    const response = await login(data);

    socket.emit('loginResponse', response);
  });

  // send all users to the client
  socket.on('getUsers', async () => {
    const data = await getUsers();
    socket.emit('getUsersResponse', data);
  });
  // Add user as a friend
  socket.on('addFriend', async ({ friendId, userId }) => {
    // add friend
    const response = await addFriend(friendId, userId);
    socket.emit('addFriendResponse', response);
    // update client firends list
    const friendsResponse = await getFriends(userId);
    io.emit('getFriendsResponse', friendsResponse);
  });
  // remove user from frined list
  socket.on('removeFriend', async ({ userId, friendId }) => {
    // remove frined
    const res = await unFriend(userId, friendId);
    // send response back
    socket.emit('removeFriendResponse', res);
    // update friend list
    const response = await getFriends(userId);
    socket.emit('getFriendsResponse', response);
  });
  // get all friends
  socket.on('getFriends', async userId => {
    const response = await getFriends(userId);
    socket.emit('getFriendsResponse', response);
  });

  // join user & friend a room
  socket.on('joinRoom', async ({ room, userId, friendId }) => {
    socket.join(room);

    // get messages assocated with this room
    const messagesResponse = await getMessages(userId, friendId);

    io.to(room).emit('message', messagesResponse);
  });

  //*****groups******
  socket.on('createGroup', async data => {
    const response = await createGroup(data);
    socket.emit('createGroupResponse', response);
    const groups = await getGoups(data.admin);
    io.emit('getGroupsResponse', groups);
  });
  // get groups
  socket.on('getGroups', async userId => {
    const groups = await getGoups(userId);
    socket.emit('getGroupsResponse', groups);
  });
  // user join room gorup
  socket.on('joinRoomGroup', async ({ room, groupId }) => {
    socket.join(room);

    // get messages assocated with this room
    const messagesResponse = await getGroupMessages(groupId);

    io.to(room).emit('message', messagesResponse);
  });

  socket.on('disconnect', () => {
    //@set user state to inactive
    console.log('A user has Left the chat ');
  });
});

server.listen(PORT, () => {
  console.log(`Server run on port ${PORT}`);
});
