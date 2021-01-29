import { Test, TestingModule } from '@nestjs/testing';
import { EntityMetadataService } from './entity-metadata.service';

describe('EntityMetadataService', () => {
  let service: EntityMetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityMetadataService],
    }).compile();

    service = module.get<EntityMetadataService>(EntityMetadataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
