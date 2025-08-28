import { beforeAll, describe, expect, it } from 'vitest';
import { initSimnet, tx } from '@hirosystems/clarinet-sdk';
import { Cl } from '@stacks/transactions';

describe('Job Registry Contract', () => {
  let simnet: Awaited<ReturnType<typeof initSimnet>>;
  let deployer: string;
  let renter: string;
  let provider: string;

  beforeAll(async () => {
    simnet = await initSimnet('./Clarinet.toml');
    const accounts = simnet.getAccounts();
    deployer = accounts.get('deployer')!;
    renter = accounts.get('wallet_1')!;
    provider = accounts.get('wallet_2')!;
  });

  it('should create a job successfully', () => {
    const createJob = tx.callPublicFn(
      'job-registry',
      'create-job',
      [
        Cl.uint(100000000),
        Cl.uint(10000000),
        Cl.uint(100),
        Cl.uint(200),
        Cl.uint(100),
        Cl.buffer(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex')),
        Cl.stringAscii('https://stackcompute.com/job/1/meta.json'),
        Cl.bool(true),
        Cl.bool(true),
        Cl.uint(1000000),
      ],
      renter,
    );

    const block = simnet.mineBlock([createJob]);
    expect(Cl.prettyPrint(block[0].result)).toBe('(ok u1)');
  });

  it('should fund a job successfully', () => {
    const createJob = tx.callPublicFn(
      'job-registry',
      'create-job',
      [
        Cl.uint(100000000),
        Cl.uint(10000000),
        Cl.uint(100),
        Cl.uint(200),
        Cl.uint(100),
        Cl.buffer(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex')),
        Cl.stringAscii('test'),
        Cl.bool(true),
        Cl.bool(true),
        Cl.uint(0),
      ],
      renter,
    );
    simnet.mineBlock([createJob]);

    const fund = tx.callPublicFn(
      'job-registry',
      'fund',
      [Cl.uint(1), Cl.uint(100000000)],
      renter,
    );
    const block = simnet.mineBlock([fund]);
    expect(Cl.prettyPrint(block[0].result)).toBe('(ok true)');
  });

  it('should register a worker successfully', () => {
    const setup = [
      tx.callPublicFn(
        'job-registry',
        'create-job',
        [
          Cl.uint(100000000),
          Cl.uint(10000000),
          Cl.uint(100),
          Cl.uint(200),
          Cl.uint(100),
          Cl.buffer(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex')),
          Cl.stringAscii('test'),
          Cl.bool(true),
          Cl.bool(true),
          Cl.uint(0),
        ],
        renter,
      ),
      tx.callPublicFn('job-registry', 'fund', [Cl.uint(1), Cl.uint(100000000)], renter),
    ];
    simnet.mineBlock(setup);

    const register = tx.callPublicFn('job-registry', 'register-worker', [Cl.uint(1)], provider);
    const block = simnet.mineBlock([register]);
    expect(Cl.prettyPrint(block[0].result)).toBe('(ok true)');
  });
});
