import type { Batch, Community, Merchant, Product, SplitGroup } from '../../../packages/domain/src/index.ts';
import { Store, now } from './db.ts';

export function seed(store: Store, profile: 'development' | 'uat' = 'development') {
  const isTest = profile === 'uat';
  const catalogSeedId = isTest ? 'seed-uat-catalog-v1' : 'seed-v1';
  const groupSeedId = isTest ? 'seed-uat-empty-groups-v1' : 'seed-empty-groups-v1';
  // Never overwrite a catalog that operators have already configured in UAT.
  if (isTest && !store.get('meta', catalogSeedId) && store.all('merchant').length) return;
  if (!store.get('meta', catalogSeedId)) store.transaction(() => {
    const merchants: Merchant[] = [
      {id:'merchant-laochen',name:'老陈 · 山姆邻里拼',city:'烟台',status:'approved',contactName:'老陈',contactPhone:'13800000001',description:'烟台社区专职代购 · 大包装按份拼',createdAt:now()},
      {id:'merchant-xiaolin',name:'小林 · 烟台山姆直采',city:'烟台',status:'approved',contactName:'小林',contactPhone:'13800000002',description:'莱山社区代购专班',createdAt:now()},
    ];
    merchants.forEach(m => store.put('merchant', isTest ? {
      ...m, name: `测试 · ${m.name}`, contactPhone: '', description: '线上流程测试商户，订单不产生真实交易',
    } : m));
    const communities: Community[] = [
      {id:'community-yangguang',merchantId:merchants[0].id,name:'阳光花园社区',station:'东区便民自提驿站',address:'烟台市芝罘区阳光花园东区便民驿站（演示地址）'},
      {id:'community-feicui',merchantId:merchants[0].id,name:'翡翠半岛花园',station:'南门物业拼单架',address:'烟台市芝罘区翡翠半岛南门（演示地址）'},
      {id:'community-laishan',merchantId:merchants[1].id,name:'莱山邻里社区',station:'社区便民自提点',address:'烟台市莱山区社区便民点（演示地址）'},
    ];
    communities.forEach(c=>store.put('community', isTest ? { ...c, name: `测试 · ${c.name}`, station: '测试自提点', address: '线上测试地址，请勿前往' } : c));
    const cutoffMs = Date.now() + (isTest ? 7 * 24 : 24) * 3600_000;
    const cutoff = new Date(cutoffMs).toISOString();
    const start = new Date(cutoffMs+4*3600_000).toISOString();
    const end = new Date(cutoffMs+8*3600_000).toISOString();
    const batches: Batch[] = merchants.map((m,i)=>({id:i===0?'batch-laochen-demo':'batch-xiaolin-demo',merchantId:m.id,title:'烟台山姆 · 本期采购专班',storeName:'山姆会员商店（采购门店待确认）',cutoffAt:cutoff,pickupStartAt:start,pickupEndAt:end,status:'open',shopperName:m.contactName,shopperPhone:m.contactPhone,note:'演示班次；实际营业排期由商户发布',photoUrls:[],receiptUrls:[]}));
    batches.forEach(b=>store.put('batch', isTest ? { ...b, title: '线上测试 · 采购班次', storeName: '测试采购门店', shopperPhone: '', note: '仅供线上流程测试，无实际采购或配送' } : b));
    const specs = [
      ['sam-p1',"Member's Mark 伯爵红茶原味瑞士卷",'双重口味组合，动物稀奶油','bakery',6800,'16片装 / 约1.2kg',true,true,'bakery','#B45309',[['split-half','拼半盒 (8片混合装)',0.5,2,'约600g',3400],['split-quarter','拼1/4份 (4片尝鲜装)',0.25,4,'约300g',1700],['whole','整盒原装代购 (16片)',1,1,'约1.2kg',6800]]],
      ['sam-p2',"Member's Mark 原味大麻薯面包",'外脆内糯，软弹香甜','bakery',3980,'24个装 / 约960g',true,false,'bakery','#D97706',[['split-half','拼半盒 (12个装)',0.5,2,'约480g',1990],['split-third','拼1/3盒 (8个装)',1/3,3,'约320g',1350],['whole','整盒原装代购 (24个)',1,1,'约960g',3980]]],
      ['sam-p3','山姆熟食工坊 招牌美式烤鸡','整只现烤，温热专送','bakery',3980,'整只约1.3kg',false,false,'bakery','#EA580C',[['whole','整只现烤出炉',1,1,'约1.3kg',3980]]],
      ['sam-p4',"Member's Mark 澳洲谷饲西冷牛排",'原切谷饲牛肉','fresh',16900,'约1.2kg / 4块',true,true,'meat','#BE123C',[['split-half','拼半份 (2块厚切牛排)',0.5,2,'约600g',8500],['whole','整盒原装代购 (4块)',1,1,'约1.2kg',16900]]],
      ['sam-p5',"Member's Mark 小青柠复合果汁饮料",'酸甜解腻，冷藏饮用','drinks',3990,'1L*2瓶',true,true,'drink','#15803D',[['split-single','拼单支 (1000ml)',0.5,2,'1000ml',2000],['whole','整组原包代购 (2瓶)',1,1,'2000ml',3990]]],
      ['sam-p6',"Member's Mark 原味混合果仁坚果桶",'无盐低温慢烤','drinks',9900,'1.1kg',true,false,'snack','#92400E',[['split-half','拼半桶 (约550g)',0.5,2,'约550g',4950],['whole','整桶原装代购',1,1,'1.1kg',9900]]],
      ['sam-p7','山姆经典 金枕头榴莲千层蛋糕','浓香软糯，支持拼半个','bakery',8800,'6英寸 / 约650g',true,true,'bakery','#CA8A04',[['split-half','拼半个 (约325g)',0.5,2,'约325g',4400],['whole','整盒原装代购',1,1,'约650g',8800]]],
      ['sam-p8','洁柔黑金系列 4层压花抽纸整箱','家居刚需，大箱囤货','home',6990,'24包 / 110抽',true,false,'grocery','#3B82F6',[['split-half','拼半箱 (12包)',0.5,2,'12包',3500],['whole','整箱原装代购',1,1,'24包',6990]]],
    ] as const;
    for (const m of merchants) for (const [id,name,subtitle,categoryId,originalPriceCents,originalSpecs,canSplit,requiresColdChain,iconType,accentColor,options] of specs) {
      const product: Product = {id:m.id===merchants[0].id?id:`${id}-xiaolin`,merchantId:m.id,name,subtitle,categoryId,originalPriceCents,originalSpecs,canSplit,requiresColdChain,stock:50,salesCount:0,tags:canSplit?['支持拼单',requiresColdChain?'冷藏保鲜':'原装直采']:['整件代购'],iconType,accentColor,options:options.map(([oid,oname,ratio,slots,weightEstimate,priceCents])=>({id:oid,name:oname,ratio,slots,weightEstimate,priceCents,description:ratio<1?'按所选份额独立分装':'原装完整包装'})),active:true};
      store.put('product',product);
    }
    store.put('meta',{id:catalogSeedId,createdAt:now()});
  });
  if(!store.get('meta',groupSeedId))store.transaction(()=>{
    const batch=store.get<Batch>('batch','batch-laochen-demo');
    if(batch?.status==='open'&&!batch.closedAt&&Date.parse(batch.cutoffAt)>Date.now()){
      for(const [productId,optionId]of [['sam-p1','split-half'],['sam-p2','split-third'],['sam-p4','split-half']]){
        const product=store.require<Product>('product',productId);const option=product.options.find(o=>o.id===optionId)!;
        const group:SplitGroup={id:`group-demo-${productId}`,merchantId:product.merchantId,productId,optionId,batchId:batch.id,communityId:'community-yangguang',productName:product.name,totalSlots:option.slots,paidSlots:0,pricePerSlotCents:option.priceCents,slotDescription:option.name,status:'recruiting',cutoffAt:batch.cutoffAt,participants:[],createdBy:isTest?'system-uat':'system-demo',createdAt:now()};store.put('group',group);
      }
    }
    store.put('meta',{id:groupSeedId,createdAt:now()});
  });
}
