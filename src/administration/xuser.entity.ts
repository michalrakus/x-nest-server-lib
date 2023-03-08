import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity('x_user')
export class XUser {

    @PrimaryGeneratedColumn({name: 'id_x_user'})
    idXUser: number;

    @Column({length: 64, nullable: false})
    username: string;

    @Column({length: 64, nullable: true})
    password: string;

    @Column({length: 128, nullable: false})
    name: string;

    @Column({nullable: false})
    enabled: boolean;
}