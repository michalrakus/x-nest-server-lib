import { Test, TestingModule } from '@nestjs/testing';
import { XEntityMetadataService } from './x-entity-metadata.service';

describe('XEntityMetadataService', () => {
  let service: XEntityMetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XEntityMetadataService],
    }).compile();

    service = module.get<XEntityMetadataService>(XEntityMetadataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
