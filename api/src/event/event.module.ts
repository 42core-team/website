import {forwardRef, Module} from "@nestjs/common";
import {EventEntity} from "./entities/event.entity";
import {TypeOrmModule} from "@nestjs/typeorm";
import {EventController} from "./event.controller";
import {EventService} from "./event.service";
import {TeamModule} from "../team/team.module";
import {UserModule} from "../user/user.module";
import {CheckController} from "./check.controller";

@Module({
    imports: [
        TypeOrmModule.forFeature([EventEntity]),
        UserModule,
        forwardRef(() => TeamModule),
    ],
    controllers: [EventController, CheckController],
    providers: [EventService],
    exports: [EventService],
})
export class EventModule {
}
