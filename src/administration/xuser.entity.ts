import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity('x_user')
export class XUser {

    @PrimaryGeneratedColumn({name: 'id_x_user'})
    idXUser: number;

    @Column({length: 64})
    username: string;

    @Column({length: 64})
    password: string;

    @Column({length: 128})
    name: string;
}