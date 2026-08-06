import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './config/env.schema';
import bcrypt from 'bcryptjs';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const adminEmail = this.configService.get('ADMIN_EMAIL', { infer: true });
    const adminPassword = this.configService.get('ADMIN_PASSWORD', {
      infer: true,
    });

    const adminExists = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!adminExists) {
      console.log('👤 Admin user not found. Seeding admin user...');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await this.prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          activeRole: 'ADMIN',
          roles: ['ADMIN'],
          isEmailVerified: true,
          firstName: 'System',
          lastName: 'Admin',
        },
      });
      console.log('✅ Admin user successfully seeded!');
    } else {
      console.log('✅ Admin user already exists.');
    }
  }

  async getHello(): Promise<string> {
    const userCount = await this.prisma.user.count();
    return `Hello World! ${userCount}`;
  }

  async triggerNotFound() {
    return this.prisma.user.update({
      where: { id: '000000000000000000000000' }, // valid ObjectId format, doesn't exist
      data: { firstName: 'test' },
    });
  }
}
