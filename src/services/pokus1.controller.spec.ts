import { Test, TestingModule } from '@nestjs/testing';
import { Pokus1Controller } from './pokus1.controller';

describe('Pokus1Controller', () => {
  let controller: Pokus1Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Pokus1Controller],
    }).compile();

    controller = module.get<Pokus1Controller>(Pokus1Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
