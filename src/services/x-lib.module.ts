import {DynamicModule, Module} from '@nestjs/common';
import {XLibController} from './x-lib.controller';
import {XLibService} from './x-lib.service';
import {XLazyDataTableService} from './x-lazy-data-table.service';
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XBrowseFormMetadataService} from "./x-browse-form-metadata.service";
import {XFileController} from "./x-file.controller";
import {XFileService} from "./x-file.service";
import {XExportService} from "./x-export.service";

@Module({})
export class XLibModule {

    // pouzivame metodku forRoot() + DynamicModule aby sme mohli v pripade potreby odovzdat parametre z AppModule
  static forRoot(): DynamicModule {

    return {
      imports: [],
      controllers: [XLibController, XFileController],
      providers: [
          XLibService,
          XLazyDataTableService,
          XExportService,
          XEntityMetadataService,
          XBrowseFormMetadataService,
          XFileService
      ],
        // servisy ktore su dostupne v inych moduloch
        exports: [
            XLibService,
            XFileService,
            XLazyDataTableService,
            XExportService
        ],
      module: XLibModule
    };
  }
}
