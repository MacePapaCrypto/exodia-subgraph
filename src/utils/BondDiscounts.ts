import { Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts'
import { OHMDAIBondV4 } from '../../generated/OHMDAIBondV4/OHMDAIBondV4';
import { DAIBondV3 } from '../../generated/DAIBondV3/DAIBondV3';
import { ETHBondV1 } from '../../generated/ETHBondV1/ETHBondV1';

import { BondDiscount, Transaction } from '../../generated/schema'
import { DAIBOND_CONTRACTS3, DAIBOND_CONTRACTS3_BLOCK, OHMDAISLPBOND_CONTRACT4, OHMDAISLPBOND_CONTRACT4_BLOCK, } from './Constants';
import { hourFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getOHMUSDRate } from './Price';

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount{
    let hourTimestamp = hourFromTimestamp(timestamp);

    let bondDiscount = BondDiscount.load(hourTimestamp)
    if (bondDiscount == null) {
        bondDiscount = new BondDiscount(hourTimestamp)
        bondDiscount.timestamp = timestamp
        bondDiscount.dai_discount  = BigDecimal.fromString("0")
        bondDiscount.ohmdai_discount = BigDecimal.fromString("0")
        bondDiscount.eth_discount = BigDecimal.fromString("0")
        bondDiscount.save()
    }
    return bondDiscount as BondDiscount
}

export function updateBondDiscounts(transaction: Transaction): void{
    let bd = loadOrCreateBondDiscount(transaction.timestamp);
    let ohmRate = getOHMUSDRate();

    //OHMDAI
    if(transaction.blockNumber.gt(BigInt.fromString(OHMDAISLPBOND_CONTRACT4_BLOCK))){
        let bond = OHMDAIBondV4.bind(Address.fromString(OHMDAISLPBOND_CONTRACT4))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.ohmdai_discount = ohmRate.div(toDecimal(price_call.value, 18))
            bd.ohmdai_discount = bd.ohmdai_discount.minus(BigDecimal.fromString("1"))
            bd.ohmdai_discount = bd.ohmdai_discount.times(BigDecimal.fromString("100"))
            log.debug("OHMDAI Discount OHM price {}  Bond Price {}  Discount {}", [ohmRate.toString(), price_call.value.toString(), bd.ohmdai_discount.toString()])
        }
        let stdDebtRatioCall = bond.try_standardizedDebtRatio()
        if(!stdDebtRatioCall.reverted) {
            bd.ohmdai_debt_ratio = stdDebtRatioCall.value;
        }
    }

    //DAI
    if(transaction.blockNumber.gt(BigInt.fromString(DAIBOND_CONTRACTS3_BLOCK))){
        let bond = DAIBondV3.bind(Address.fromString(DAIBOND_CONTRACTS3))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.dai_discount = ohmRate.div(toDecimal(price_call.value, 18))
            bd.dai_discount = bd.dai_discount.minus(BigDecimal.fromString("1"))
            bd.dai_discount = bd.dai_discount.times(BigDecimal.fromString("100"))
            log.debug("DAI Discount OHM price {}  Bond Price {}  Discount {}", [ohmRate.toString(), price_call.value.toString(), bd.dai_discount.toString()])
        }
        let stdDebtRatioCall = bond.try_standardizedDebtRatio()
        if(!stdDebtRatioCall.reverted) {
            bd.dai_debt_ratio = stdDebtRatioCall.value;
        }
    }

    bd.save()
}
