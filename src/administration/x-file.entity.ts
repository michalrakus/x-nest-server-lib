import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {Buffer} from "buffer";

@Entity('x_file')
export class XFile {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 256, nullable: false})
    name: string;

    @Column({nullable: false})
    size: number;

    @Column({name: 'path_name', length: 256, nullable: true})
    pathName: string;

    // select: false - nechceme selectovat stlpec lebo obsahuje vela dat
    @Column({type: "longblob", nullable: true, select: false, })
    data: Buffer;

    @Column({name: 'modif_date', type: 'datetime', nullable: true})
    modifDate: Date;

    // tuto len jednoduchy number atribut, lebo namiesto XUser triedy pouzivame v aplikacii specificku napr. XUserSkch a nefunguje start backendu koli tomu
    @Column({name: 'modif_x_user_id', nullable: true})
    modifXUser: number;
}
