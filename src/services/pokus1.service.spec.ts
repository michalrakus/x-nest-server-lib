import { Test, TestingModule } from '@nestjs/testing';
import { Pokus1Service } from './pokus1.service';

describe('Pokus1Service', () => {
  let service: Pokus1Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Pokus1Service],
    }).compile();

    service = module.get<Pokus1Service>(Pokus1Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
