import { Test, TestingModule } from '@nestjs/testing';
import { XLibController } from './x-lib.controller';

describe('XLibController', () => {
  let controller: XLibController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [XLibController],
    }).compile();

    controller = module.get<XLibController>(XLibController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
