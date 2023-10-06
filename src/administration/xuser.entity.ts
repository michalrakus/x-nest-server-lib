import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, VersionColumn} from "typeorm";

@Entity('x_user')
export class XUser {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 64, nullable: false})
    username: string;

    @Column({length: 64, nullable: true})
    password: string;

    @Column({length: 128, nullable: false})
    name: string;

    @Column({nullable: false})
    enabled: boolean;

    @Column({nullable: false})
    admin: boolean;

    // for mysql use type: 'datetime'
    // for postgres use type: 'timestamp'
    @Column({name: 'modif_date', type: 'timestamp', nullable: true})
    modifDate: Date;

    @ManyToOne(() => XUser, {nullable: true})
    @JoinColumn({ name: 'modif_x_user_id' })
    modifXUser: XUser;

    @VersionColumn()
    version: number;
}