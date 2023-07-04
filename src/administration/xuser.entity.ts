import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, VersionColumn} from "typeorm";

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

    @Column({name: 'modif_date', type: 'datetime', nullable: true})
    modifDate?: Date;

    @ManyToOne(() => XUser, {nullable: true})
    @JoinColumn({ name: 'modif_x_user_id' })
    modifXUser: XUser;

    @VersionColumn()
    version: number;
}