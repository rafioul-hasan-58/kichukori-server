import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async updateProfile(userId: string, data: Prisma.UserUpdateInput) {
    const updatedUser = await this.usersRepository.update(userId, data);

    // Omit sensitive password field
    const userWithoutPassword = { ...updatedUser } as Record<string, any>;
    delete userWithoutPassword.password;
    return userWithoutPassword;
  }
}
