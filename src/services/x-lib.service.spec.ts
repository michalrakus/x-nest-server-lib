import { Test, TestingModule } from '@nestjs/testing';
import { XLibService } from './x-lib.service';

describe('XLibService', () => {
  let service: XLibService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XLibService],
    }).compile();

    service = module.get<XLibService>(XLibService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
