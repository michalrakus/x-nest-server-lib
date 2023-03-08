import {Injectable} from "@nestjs/common";
import {DataSource, SelectQueryBuilder} from "typeorm";
import {XBrowseMetaMap} from "../serverApi/XBrowseMetadata";
import {XBrowseMeta} from "../administration/x-browse-meta.entity";

@Injectable()
export class XBrowseFormMetadataService {

    constructor(
        private readonly dataSource: DataSource
    ) {}

    async getXBrowseMetaMap(): Promise<XBrowseMetaMap> {

        const repository = this.dataSource.getRepository(XBrowseMeta);
        const selectQueryBuilder: SelectQueryBuilder<XBrowseMeta> = repository.createQueryBuilder("xBrowseMeta");
        selectQueryBuilder.leftJoinAndSelect("xBrowseMeta.columnMetaList", "xColumnMeta");
        selectQueryBuilder.orderBy({"xBrowseMeta.idXBrowseMeta": "ASC", "xColumnMeta.columnOrder": "ASC"});
        const xBrowseMetaList: XBrowseMeta[] = await selectQueryBuilder.getMany();

        const xBrowseMetaMap: XBrowseMetaMap = {};
        for (const xBrowseMeta of xBrowseMetaList) {
            let key = xBrowseMeta.entity;
            if (xBrowseMeta.browseId !== null) {
               key = key + '_' + xBrowseMeta.browseId;
            }
            xBrowseMetaMap[key] = xBrowseMeta;
        }
        return xBrowseMetaMap;
    }

    // for the future
    // getXFormMetaMap(): Promise<XFormMetaMap> {
    // }
}
