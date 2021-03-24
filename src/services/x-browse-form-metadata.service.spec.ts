import { Test, TestingModule } from '@nestjs/testing';
import { XBrowseFormMetadataService } from './x-browse-form-metadata.service';

describe('XBrowseFormMetadataService', () => {
    let service: XBrowseFormMetadataService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [XBrowseFormMetadataService],
        }).compile();

        service = module.get<XBrowseFormMetadataService>(XBrowseFormMetadataService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
