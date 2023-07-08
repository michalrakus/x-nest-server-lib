import {Injectable} from "@nestjs/common";
import {DataSource, Repository, SelectQueryBuilder} from "typeorm";
import {XFile} from "../administration/x-file.entity";

@Injectable()
export class XFileService {

    constructor(
        private readonly dataSource: DataSource
    ) {
    }

    async saveXFile(xFile: XFile): Promise<XFile> {
        const repository: Repository<XFile> = this.dataSource.getRepository(XFile);
        const xFileReloaded: XFile = await repository.save(xFile);
        delete xFileReloaded.data; // nechceme vracat subor
        return xFileReloaded;
    }

    async readXFileByIdWithData(id: number): Promise<XFile> {
        // const repository: Repository<CarOwnerFile> = this.dataSource.getRepository(CarOwnerFile);
        // const selectQueryBuilder : SelectQueryBuilder<unknown> = repository.createQueryBuilder(rootAlias);
        const selectQueryBuilder: SelectQueryBuilder<XFile> = this.dataSource.createQueryBuilder(XFile, 'xFile');
        // explicitne vytvarame SELECT klauzulu, lebo stlpec "data" mame oznaceny ako "select: false" - defaultne ho neselectujeme
        selectQueryBuilder
            .select('xFile.id')
            .addSelect('xFile.name')
            .addSelect('xFile.size')
            .addSelect('xFile.pathName')
            .addSelect('xFile.data');
        selectQueryBuilder.whereInIds([id]);
        return await selectQueryBuilder.getOneOrFail();
    }
}