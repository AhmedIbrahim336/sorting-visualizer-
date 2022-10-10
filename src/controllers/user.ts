import User, { IUserWithoutPassword, UserStatus } from "../models/User";
import { v4 } from "uuid";
import moment from "moment";
import { getErrMsg, errorHandler } from "../utils/error";
import { cloneObj } from "../utils";
import { SuccessRes } from "../types";

export type Register = {
  username: string;
  email: string;
  password: string;
};

export const register = errorHandler<
  Register,
  {
    success: boolean;
    user: IUserWithoutPassword;
  }
>(async (data) => {
  const { email } = data;
  const isExist = await User.findOne({ email });
  if (isExist) throw new Error("User already exist");

  const user = await User.create(data);
  const withoutPassword = cloneObj(user, ["password"]);

  return {
    success: true,
    user: withoutPassword,
  };
});

export type Login = {
  username: string;
  email: string;
  password: string;
};

export const login = errorHandler<
  Login,
  SuccessRes<{ user: IUserWithoutPassword }>
>(async (data) => {
  const { email, password } = data;
  const user = await User.findOne({ email });
  if (!user || user.password.toString() !== password) {
    throw new Error("Please enter valid email and password");
  }

  const withoutPassword = cloneObj(user, ["password"]);

  return {
    success: true,
    user: withoutPassword,
  };
});

export async function getUsers() {
  try {
    const users = await User.find({}).select("username email avatar");
    const count = users.length;
    return { count, users };
  } catch (err) {
    return {
      error: getErrMsg(err),
    };
  }
}

export type AddFriend = {
  friendId: string;
  userId: string;
};

export async function addFriend({ friendId, userId }: AddFriend) {
  try {
    if (!userId) return { error: "Unauthorized to add friends" };
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);
    // validate the users
    if (!user || !friend) return { error: "User Not found" };
    // check if the user add himself
    if (userId === friendId)
      return { error: "Can't add youself as an a friend" };
    // check if they are already friends
    const isAreadyFriend = user.friends.find(
      (friend) => friend.user?.toString() === friendId
    );
    if (isAreadyFriend)
      return {
        error: "You are already friends",
      };
    // add as friends
    const room = v4();
    user.friends.push({
      user: friend,
      room,
      messages: [],
    });
    friend.friends.push({
      user: user,
      room,
      messages: [],
    });
    await user.save();
    await friend.save();

    return {
      success: true,
    };
  } catch (error) {
    return { error: getErrMsg(error) };
  }
}
export async function getFriends(userId: string) {
  try {
    if (!userId) return { error: "Unauthorized to add friends" };
    const user = await User.findById(userId).populate({
      path: "friends.user",
      select: "username email avatar",
    });
    // validate the user
    if (!user) return { error: "User Not found" };
    const friends = user.friends;

    return {
      success: true,
      friends,
    };
  } catch (error) {
    return { error: getErrMsg(error) };
  }
}

export type SendMessage = {
  friendId: string;
  userId: string;
  text: string;
};

export async function sendMessage({ friendId, userId, text }: SendMessage) {
  try {
    if (!userId) return { error: "Unauthorized to add friends" };
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);
    // validate the users
    if (!user) return { error: "User Not found" };
    if (!friend) return { error: "Friend Not found" };
    // check if the user add himself
    // check if they are already friends
    const isFriend = user.friends.find(
      (friend) => friend.user.toString() === friendId
    );
    if (!isFriend)
      return {
        error: "Can't send Message to this user ",
      };
    const time = moment().format("h:mm a");
    // find the friend
    const findFriend = user.friends.find(
      (friend) => friend.user.toString() === friendId
    );

    const message = {
      time,
      sender: user._id,
      receiver: friend._id,
      text,
    };

    findFriend?.messages.push(message);
    // find the user in the his friend set
    const findUser = friend.friends.find(
      (friend) => friend.user.toString() === userId
    );
    findUser?.messages.push(message);
    await user.save();
    await friend.save();

    return {
      success: true,
    };
  } catch (error) {
    return { error: getErrMsg(error) };
  }
}

export type GetMessages = {
  userId: string;
  friendId: string;
};

export async function getMessages({ userId, friendId }: GetMessages) {
  try {
    const user = await User.findById(userId)
      .populate({
        path: "friends.messages.receiver",
        select: "username ",
      })
      .populate({
        path: "friends.messages.sender",
        select: "username ",
      });

    if (!user) {
      return {
        error: "User Not Found",
      };
    }

    const friend = user.friends.find(
      (friend) => friend.user.toString() === friendId
    );
    if (!friend) {
      return {
        error: "Friend Not Found",
      };
    }
    return {
      success: true,
      messages: friend.messages,
    };
  } catch (error) {
    return {
      error: getErrMsg(error),
    };
  }
}

export type SetUserStatus = {
  userId: string;
  status: UserStatus;
};

export const setUserStatus = errorHandler<SetUserStatus, SuccessRes<{}>>(
  async ({ userId, status }) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    user.status = status;
    await user.save();
    return {
      success: true,
    };
  }
);

export const getUserStatus = errorHandler<
  string,
  SuccessRes<{ status: UserStatus }>
>(async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  return { success: true, status: user.status };
});

type RemoveFriend = {
  userId: string;
  friendId: string;
};

export async function removeFriend({ userId, friendId }: RemoveFriend) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        error: "User not found",
      };
    }
    user.friends = user.friends.filter(
      (friend) => friend.user.toString() !== friendId
    );
    await user.save();
    return {
      success: true,
    };
  } catch (error) {
    return { error: getErrMsg(error) };
  }
}

export const getUserById = errorHandler(async (id: string) => {
  const user = await User.findById(id);
  if (!user) throw new Error("User Not Found");
  const withoutPassword = cloneObj(user, ["password"]);
  return {
    success: true,
    user: withoutPassword,
  };
});

export type UpdateUser = {
  userId: string;
  username?: string;
  email?: string;
  oldPassword?: string;
  newPassword?: string;
};

export const updateUser = errorHandler<
  UpdateUser,
  SuccessRes<{ user: IUserWithoutPassword }>
>(async ({ userId, username, email, oldPassword, newPassword }) => {
  console.log({
    userId,
    username,
  });
  const user = await User.findById(userId);
  if (!user) throw new Error("User Not Found");

  user.username = username || user.username;
  user.email = email || user.email;

  if (newPassword) {
    if (user.password.toString() !== oldPassword)
      throw new Error("Passwords doesn't matches");

    user.password = newPassword;
  }

  const updated = await user.save();
  const withoutPassword = cloneObj(updated, ["password"]);

  return {
    success: true,
    user: withoutPassword,
  };
});
