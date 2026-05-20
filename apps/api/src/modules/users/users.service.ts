import { Injectable } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  list() {
    return {
      items: [],
      module: "users",
      capabilities: ["invite user", "assign role", "scope branch access"],
    };
  }

  create(payload: CreateUserDto) {
    return {
      ...payload,
      status: "INVITED",
      message: "User creation flow scaffolded",
    };
  }
}

