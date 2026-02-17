import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  profilePicture: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  githubId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  githubAccessToken: string;
}
