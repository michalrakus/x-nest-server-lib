import {DynamicModule, Module} from '@nestjs/common';
import {XLibController} from './x-lib.controller';
import {XLibService} from './x-lib.service';
import {XLazyDataTableService} from './x-lazy-data-table.service';
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XBrowseFormMetadataService} from "./x-browse-form-metadata.service";

@Module({})
export class XLibModule {

    // pouzivame metodku forRoot() + DynamicModule aby sme mohli v pripade potreby odovzdat parametre z AppModule
  static forRoot(): DynamicModule {

    return {
      imports: [],
      controllers: [XLibController],
      providers: [
          XLibService,
          XLazyDataTableService,
          XEntityMetadataService,
          XBrowseFormMetadataService
      ],
        // servisy ktore su dostupne v inych moduloch
        exports: [
            XLibService,
            XLazyDataTableService
        ],
      module: XLibModule
    };
  }
}
