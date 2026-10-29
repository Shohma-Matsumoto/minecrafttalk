import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLLMResponse, validateCommand, validateCommands } from './commands';

function isValid(command: string): boolean {
  return validateCommand(command).valid;
}

test('通常の許可コマンドは通る', () => {
  assert.equal(isValid('/give @s diamond 64'), true);
  assert.equal(isValid('/setblock ~1 ~0 ~0 stone'), true);
  assert.equal(isValid('/tp @s ~0 ~10 ~0'), true);
  assert.equal(isValid('/gamemode creative @s'), true);
  assert.equal(isValid('/clear @s'), true);
  assert.equal(isValid('/clear'), true);
  assert.equal(isValid('/time set day'), true);
  assert.equal(isValid('/fill ~0 ~0 ~1 ~0 ~0 ~10 dirt'), true);
  assert.equal(isValid('/fill 100 64 100 105 70 105 stone'), true);
});

test('他プレイヤー・全体を対象にするセレクタは拒否する', () => {
  assert.equal(isValid('/clear @a'), false);
  assert.equal(isValid('/give @a diamond 64'), false);
  assert.equal(isValid('/gamemode creative @a'), false);
  assert.equal(isValid('/effect @e[type=pig] speed 30 2'), false);
  assert.equal(isValid('/tp @r ~0 ~10 ~0'), false);
  assert.equal(isValid('/summon pig ~2 ~0 ~0 @p'), false);
});

test('名前指定で他プレイヤーを対象にするコマンドは拒否する', () => {
  assert.equal(isValid('/clear Steve'), false);
  assert.equal(isValid('/give Steve diamond 64'), false);
  assert.equal(isValid('/gamemode creative Steve'), false);
  assert.equal(isValid('/tp Steve ~0 ~10 ~0'), false);
  assert.equal(isValid('/enchant Steve sharpness 5'), false);
});

test('改行・制御文字を含むコマンドは拒否する', () => {
  assert.equal(isValid('/give @s diamond\n/op @s'), false);
  assert.equal(isValid('/give @s diamond\r\n/stop'), false);
  assert.equal(isValid('/give @s diamond /stop'), false);
  assert.equal(isValid('/give @s diamond\u0000'), false);
});

test('過度に長いコマンドは拒否する', () => {
  assert.equal(isValid(`/give @s diamond ${'1'.repeat(1000)}`), false);
});

test('/fill は範囲を判定できない座標を拒否する', () => {
  assert.equal(isValid('/fill abc 0 0 1 1 1 stone'), false);
  assert.equal(isValid('/fill ~ ~ ~ 5 5 5 stone'), false, '相対と絶対の混在は範囲不明');
  assert.equal(isValid('/fill 0 0 0 1e5 1 1 stone'), false);
  assert.equal(isValid('/fill 0 0 0 Infinity 1 1 stone'), false);
  assert.equal(isValid('/fill 0 0 0 100 1 1 stone'), false);
  assert.equal(isValid('/fill ~-2 64 ~1 ~2 66 ~5 stone'), true, '軸ごとに種別が揃っていれば許可');
});

test('禁止コマンド・未許可コマンドは拒否する', () => {
  assert.equal(isValid('/op @s'), false);
  assert.equal(isValid('/execute as @a run say hi'), false);
  assert.equal(isValid('/stop'), false);
});

test('validateCommands は配列内の非文字列を拒否する', () => {
  const nonString = 1;
  const result = validateCommands([nonString, '/time set day']);
  assert.deepEqual(result.validCommands, ['/time set day']);
  assert.equal(result.errors.length, 1);
});

test('parseLLMResponse は commands に文字列以外が含まれる応答を拒否する', () => {
  assert.throws(() => parseLLMResponse('{"commands": [1, {"a": 2}], "message": "x"}'));
  assert.deepEqual(parseLLMResponse('{"commands": ["/time set day"], "message": "x"}'), {
    commands: ['/time set day'],
    message: 'x',
  });
});
