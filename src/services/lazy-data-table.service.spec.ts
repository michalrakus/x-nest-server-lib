import { Test, TestingModule } from '@nestjs/testing';
import { LazyDataTableService } from './lazy-data-table.service';

describe('LazyDataTableService', () => {
  let service: LazyDataTableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LazyDataTableService],
    }).compile();

    service = module.get<LazyDataTableService>(LazyDataTableService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
