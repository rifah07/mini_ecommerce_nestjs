import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findAll() {
    return this.repo.find({
      select: ['id', 'name', 'email', 'role', 'createdAt'],
    });
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'role', 'createdAt'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await this.repo.remove(user);
    return { message: 'User deleted successfully' };
  }
}
