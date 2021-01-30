import { Test, TestingModule } from '@nestjs/testing';
import { XLazyDataTableService } from './x-lazy-data-table.service';

describe('XLazyDataTableService', () => {
  let service: XLazyDataTableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XLazyDataTableService],
    }).compile();

    service = module.get<XLazyDataTableService>(XLazyDataTableService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
